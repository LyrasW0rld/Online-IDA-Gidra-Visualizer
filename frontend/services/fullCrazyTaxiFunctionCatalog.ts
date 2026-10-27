import { DecompiledFunction } from '../types';
import { buildDynamicCfgFromPseudocode } from './cfgBuilder';
import { inferClassAndMethod } from './i64BinaryParser';

interface SubsystemCatalogEntry {
  baseAddr: number;
  count: number;
  stride: number;
  prefix: string;
  className?: string;
  tag: string;
  callingConv: DecompiledFunction['callingConvention'];
  returnType: string;
  isRenamedRatio: number;
  namedRoutines: {
    name: string;
    params: string;
    vars: { oldName: string; name: string; type: string; location: string; comment?: string }[];
    bodyLines: string[];
    comment: string;
  }[];
}

const CRAZY_TAXI_SUBSYSTEM_CATALOG: SubsystemCatalogEntry[] = [
  {
    baseAddr: 0x00401200,
    count: 95,
    stride: 0x90,
    prefix: 'Win32_System',
    className: undefined,
    tag: 'Win32',
    callingConv: '__stdcall',
    returnType: 'int',
    isRenamedRatio: 0.78,
    namedRoutines: [
      {
        name: 'Win32_WndProcCallback',
        params: 'HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam',
        vars: [
          { oldName: 'a1', name: 'hWnd', type: 'HWND', location: 'ebp+0x08' },
          { oldName: 'a2', name: 'uMsg', type: 'UINT', location: 'ebp+0x0C' },
          { oldName: 'v4', name: 'lResult', type: 'LRESULT', location: 'eax' }
        ],
        bodyLines: [
          'switch ( uMsg )',
          '{',
          '  case WM_ACTIVATEAPP:',
          '    g_bWindowActive_0058C144 = (wParam != 0);',
          '    Audio_SetMasterMute_0048C090(wParam == 0);',
          '    return 0;',
          '  case WM_DESTROY:',
          '  case WM_CLOSE:',
          '    g_bRequestExit_0058C148 = 1;',
          '    PostQuitMessage(0);',
          '    return 0;',
          '  case WM_SETCURSOR:',
          '    if ( !g_bWindowedMode_0058C168 )',
          '    {',
          '      SetCursor(0);',
          '      return 1;',
          '    }',
          '    break;',
          '}',
          'return DefWindowProcA(hWnd, uMsg, wParam, lParam);'
        ],
        comment: 'Main Window Procedure handling WM_ACTIVATEAPP focus pause, cursor hiding in fullscreen, and clean shutdown.'
      },
      {
        name: 'Timer_QueryPerformanceFrequencyInit',
        params: 'void',
        vars: [
          { oldName: 'v1', name: 'liFreq', type: 'LARGE_INTEGER', location: 'ebp-0x08' },
          { oldName: 'v2', name: 'fInvFreq', type: 'double', location: 'st7' }
        ],
        bodyLines: [
          'if ( !QueryPerformanceFrequency(&liFreq) )',
          '  return 0;',
          'g_PerfCounterFreq_0058C180 = liFreq.QuadPart;',
          'g_dSecondsPerTick_0058C188 = 1.0 / (double)liFreq.QuadPart;',
          'if ( g_dSecondsPerTick_0058C188 <= 0.0 )',
          '  g_dSecondsPerTick_0058C188 = 0.000001;',
          'QueryPerformanceCounter(&g_LastFrameCounter_0058C190);',
          'return 1;'
        ],
        comment: 'Initializes high-resolution QPC hardware timer for the 60.0 Hz Dreamcast frame pacing loop.'
      },
      {
        name: 'Timer_WaitNextFrame60Hz',
        params: 'void',
        vars: [
          { oldName: 'v1', name: 'liNow', type: 'LARGE_INTEGER', location: 'ebp-0x08' },
          { oldName: 'v2', name: 'fElapsedSec', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'do',
          '{',
          '  QueryPerformanceCounter(&liNow);',
          '  fElapsedSec = (float)((double)(liNow.QuadPart - g_LastFrameCounter_0058C190.QuadPart) * g_dSecondsPerTick_0058C188);',
          '  if ( fElapsedSec < 0.012f )',
          '    Sleep(1u);',
          '}',
          'while ( fElapsedSec < 0.016666668f );',
          'g_LastFrameCounter_0058C190 = liNow;',
          'return fElapsedSec * 60.0f;'
        ],
        comment: 'Busy-waits until 16.666ms (1/60 sec) has elapsed. Frequently patched by high-FPS mods.'
      },
      {
        name: 'Input_InitDirectInput8Controllers',
        params: 'HINSTANCE hInst, HWND hWnd',
        vars: [
          { oldName: 'v1', name: 'hr', type: 'HRESULT', location: 'eax' },
          { oldName: 'v2', name: 'pDInput', type: 'IDirectInput8A *', location: 'esi' }
        ],
        bodyLines: [
          'hr = DirectInput8Create(hInst, 0x800u, &IID_IDirectInput8A, (LPVOID *)&g_pDirectInput8_00592000, 0);',
          'if ( hr < 0 )',
          '  return 0;',
          'pDInput = g_pDirectInput8_00592000;',
          'IDirectInput8_EnumDevices(pDInput, 4u, Input_EnumJoysticksCallback_00408120, hWnd, 1u);',
          'if ( !Input_CreateKeyboardDevice_00408290(pDInput, hWnd) )',
          '  return -1;',
          'return 1;'
        ],
        comment: 'Initializes DirectInput8 keyboard and racing wheel / gamepad devices.'
      },
      {
        name: 'Input_PollDirectInputDevices',
        params: 'void',
        vars: [
          { oldName: 'v1', name: 'uPrevMask', type: 'unsigned int', location: 'ecx' },
          { oldName: 'v2', name: 'uNewMask', type: 'unsigned int', location: 'eax' },
          { oldName: 'diState', name: 'joyState', type: 'DIJOYSTATE2', location: 'ebp-0x110' }
        ],
        bodyLines: [
          'uPrevMask = g_ControllerInputMask_00592004;',
          'uNewMask = Input_ReadKeyboardBitmask_00408510();',
          'if ( g_pGamepadDevice_00592010 )',
          '{',
          '  IDirectInputDevice8_Poll(g_pGamepadDevice_00592010);',
          '  if ( IDirectInputDevice8_GetDeviceState(g_pGamepadDevice_00592010, 272u, &joyState) >= 0 )',
          '  {',
          '    g_fAnalogSteerAxis_00592018 = (float)joyState.lX * 0.0009765625f;',
          '    if ( joyState.rgbButtons[0] & 0x80 ) uNewMask |= INPUT_SHIFT_DRIVE;',
          '    if ( joyState.rgbButtons[1] & 0x80 ) uNewMask |= INPUT_SHIFT_REVERSE;',
          '  }',
          '}',
          'g_ControllerInputMask_00592004 = uNewMask;',
          'g_ControllerInputEdge_00592008 = uNewMask & ~uPrevMask;'
        ],
        comment: 'Polls keyboard and gamepad axes, computing rising-edge button transitions for Crazy Dash and Reverse-Drive shifts.'
      }
    ]
  },
  {
    baseAddr: 0x00413000,
    count: 260,
    stride: 0xB0,
    prefix: 'TaxiPhysics',
    className: 'CTaxiPhysicsBody',
    tag: 'Physics',
    callingConv: '__thiscall',
    returnType: 'void',
    isRenamedRatio: 0.72,
    namedRoutines: [
      {
        name: 'TaxiPhysics_UpdateSuspensionSprings',
        params: 'CTaxiPhysicsBody *pCab, float fDeltaStep',
        vars: [
          { oldName: 'this', name: 'pCab', type: 'CTaxiPhysicsBody *', location: 'ecx' },
          { oldName: 'v2', name: 'iWheelIdx', type: 'int', location: 'esi' },
          { oldName: 'v3', name: 'fSpringForce', type: 'float', location: 'xmm0_4' },
          { oldName: 'v4', name: 'fDamperForce', type: 'float', location: 'xmm1_4' }
        ],
        bodyLines: [
          'for ( iWheelIdx = 0; iWheelIdx < 4; ++iWheelIdx )',
          '{',
          '  fSpringForce = (pCab->fRestSuspensionLen - pCab->fCurrentCompression[iWheelIdx]) * pCab->fSpringStiffnessK;',
          '  fDamperForce = pCab->fSuspensionVelocity[iWheelIdx] * pCab->fShockDampingC;',
          '  pCab->fWheelVerticalLoad[iWheelIdx] = fSpringForce - fDamperForce;',
          '  if ( pCab->fWheelVerticalLoad[iWheelIdx] < 0.0f )',
          '    pCab->fWheelVerticalLoad[iWheelIdx] = 0.0f;',
          '}',
          'TaxiPhysics_ApplyBodyRollAndPitchTorque_0043AA40(pCab, fDeltaStep);'
        ],
        comment: 'Computes independent 4-wheel Hooke spring + damper forces that give the Crazy Taxi cabs their signature bouncy San Francisco hill landings.'
      },
      {
        name: 'TaxiPhysics_ExecuteCrazyStopBrakeBoost',
        params: 'CTaxiPhysicsBody *pCab, float fDeltaStep',
        vars: [
          { oldName: 'this', name: 'pCab', type: 'CTaxiPhysicsBody *', location: 'ecx' },
          { oldName: 'v2', name: 'fDecelRate', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'if ( pCab->currentGearState == GEAR_REVERSE && pCab->framesSinceShiftToReverse <= 6 )',
          '{',
          '  if ( (g_ControllerInputMask_00592004 & INPUT_BRAKE_PEDAL) != 0 )',
          '  {',
          '    fDecelRate = pCab->fBaseBrakeTorque * 3.15f;',
          '    pCab->vVelocityWorld.x *= (1.0f - 0.12f * fDeltaStep);',
          '    pCab->vVelocityWorld.z *= (1.0f - 0.12f * fDeltaStep);',
          '    pCab->uPhysicsFlags |= FLAG_CRAZY_STOP_ACTIVE;',
          '    Audio_PlaySfxBank_0048A110(SFX_TIRE_SCREECH_STOP);',
          '  }',
          '}'
        ],
        comment: 'Implements the Crazy Stop technique (Shift to Reverse + immediate Brake within 6 frames) for instant drop-off zone stopping.'
      },
      {
        name: 'TaxiPhysics_ExecuteCrazyDrift180Spin',
        params: 'CTaxiPhysicsBody *pCab, float fDeltaStep',
        vars: [
          { oldName: 'this', name: 'pCab', type: 'CTaxiPhysicsBody *', location: 'ecx' },
          { oldName: 'v3', name: 'fYawImpulse', type: 'float', location: 'xmm2_4' }
        ],
        bodyLines: [
          'if ( (pCab->uPhysicsFlags & FLAG_CRAZY_DRIFT_SLIDING) != 0 )',
          '{',
          '  fYawImpulse = pCab->fAngularYawVelocity * 0.94f;',
          '  pCab->fHeadingYawRad += fYawImpulse * fDeltaStep;',
          '  if ( fabs(fYawImpulse) < 0.05f )',
          '    pCab->uPhysicsFlags &= ~FLAG_CRAZY_DRIFT_SLIDING;',
          '}'
        ],
        comment: 'Integrates angular yaw velocity during a Crazy Drift or 180-degree Crazy Turn.'
      },
      {
        name: 'TaxiPhysics_ResolveBuildingWallBounce',
        params: 'CTaxiPhysicsBody *pCab, NJS_VECTOR *pWallNormal, float fPenetrationDepth',
        vars: [
          { oldName: 'this', name: 'pCab', type: 'CTaxiPhysicsBody *', location: 'ecx' },
          { oldName: 'v4', name: 'fDotVelNormal', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'pCab->vWorldPos.x += pWallNormal->x * fPenetrationDepth;',
          'pCab->vWorldPos.z += pWallNormal->z * fPenetrationDepth;',
          'fDotVelNormal = (pCab->vVelocityWorld.x * pWallNormal->x) + (pCab->vVelocityWorld.z * pWallNormal->z);',
          'if ( fDotVelNormal < 0.0f )',
          '{',
          '  pCab->vVelocityWorld.x -= pWallNormal->x * (fDotVelNormal * 1.45f);',
          '  pCab->vVelocityWorld.z -= pWallNormal->z * (fDotVelNormal * 1.45f);',
          '  pCab->uCollisionFlags |= COLLISION_HARD_IMPACT;',
          '}'
        ],
        comment: 'Reflects cab velocity vector off city building walls and sets COLLISION_HARD_IMPACT to reset active stunt combos.'
      },
      {
        name: 'TaxiPhysics_LoadDriverHandlingProfile',
        params: 'CTaxiPhysicsBody *pCab, int eDriverCharacterId',
        vars: [
          { oldName: 'this', name: 'pCab', type: 'CTaxiPhysicsBody *', location: 'ecx' },
          { oldName: 'a2', name: 'eDriverCharacterId', type: 'int', location: 'ebp+0x08', comment: '0=Axel, 1=BD Joe, 2=Gena, 3=Gus' },
          { oldName: 'v3', name: 'pSpec', type: 'SDriverHandlingSpec *', location: 'esi' }
        ],
        bodyLines: [
          'pSpec = &g_DriverHandlingSpecs_00571040[eDriverCharacterId & 3];',
          'pCab->fVehicleMassKg = pSpec->fMassKg;',
          'pCab->fBaseDashTorque = pSpec->fAccelerationTorque;',
          'if ( eDriverCharacterId == DRIVER_GUS )',
          '  pCab->fTopSpeedKph = pSpec->fMaxSpeedKph * 1.06f;',
          'else',
          '  pCab->fTopSpeedKph = pSpec->fMaxSpeedKph;',
          'pCab->fCorneringGrip = pSpec->fLateralGripCoeff;',
          'pCab->currentGearState = GEAR_DRIVE;'
        ],
        comment: 'Loads per-driver cab stats: Gus (heavy, high top speed), Gena (lightweight, fast acceleration), BD Joe, or Axel.'
      }
    ]
  },
  {
    baseAddr: 0x00442000,
    count: 230,
    stride: 0x98,
    prefix: 'PassengerAI',
    className: 'CPassengerManager',
    tag: 'Passenger',
    callingConv: '__cdecl',
    returnType: 'int',
    isRenamedRatio: 0.68,
    namedRoutines: [
      {
        name: 'PassengerManager_TestPickupCircleCollision',
        params: 'CTaxiPhysicsBody *pCab',
        vars: [
          { oldName: 'v1', name: 'iSlot', type: 'int', location: 'edi' },
          { oldName: 'v2', name: 'pCandidate', type: 'CPassengerActor *', location: 'esi' },
          { oldName: 'v3', name: 'fCabSpeed', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'fCabSpeed = pCab->fForwardSpeed;',
          'if ( fCabSpeed > 3.2f )',
          '  return 0;',
          'for ( iSlot = 0; iSlot < 128; ++iSlot )',
          '{',
          '  pCandidate = &g_CityPassengerPool_00596000[iSlot];',
          '  if ( pCandidate->eState == PASSENGER_WAITING_WAVING )',
          '  {',
          '    if ( Math_DistanceXZSq_00409180(&pCab->vWorldPos, &pCandidate->vSpawnPos) <= pCandidate->fRingRadiusSq )',
          '    {',
          '      PassengerManager_BeginBoardingSequence_0044A340(pCab, pCandidate);',
          '      return 1;',
          '    }',
          '  }',
          '}',
          'return 0;'
        ],
        comment: 'Checks if the player cab has stopped inside a customer fare ring and triggers the passenger jump-in animation.'
      },
      {
        name: 'PassengerManager_BeginBoardingSequence',
        params: 'CTaxiPhysicsBody *pCab, CPassengerActor *pCustomer',
        vars: [
          { oldName: 'a1', name: 'pCab', type: 'CTaxiPhysicsBody *', location: 'ebp+0x08' },
          { oldName: 'a2', name: 'pCustomer', type: 'CPassengerActor *', location: 'ebp+0x0C' },
          { oldName: 'v3', name: 'nDestNodeId', type: 'int', location: 'eax' }
        ],
        bodyLines: [
          'pCab->pCurrentPassenger = pCustomer;',
          'pCustomer->eState = PASSENGER_IN_CAB_RIDING;',
          'pCustomer->nActiveComboCount = 0;',
          'pCustomer->fAccumulatedTipMoney = 0.0f;',
          'nDestNodeId = pCustomer->nTargetDestinationId;',
          'if ( nDestNodeId >= 0 && nDestNodeId < 64 )',
          '  g_ActiveDropoffZone_00595100 = g_CityDropoffZones_00573000[nDestNodeId];',
          'Audio_PlayPassengerVoiceClip_0048A920(pCustomer->nVoiceBankId, VOICE_HEY_TAXI_TAKE_ME_TO);',
          'return nDestNodeId;'
        ],
        comment: 'Binds the boarded passenger to the cab, activates the green destination zone, and plays the customer destination voice line.'
      },
      {
        name: 'PassengerManager_CompleteDropoffAndAwardBonusTime',
        params: 'CTaxiPhysicsBody *pCab',
        vars: [
          { oldName: 'v1', name: 'pCustomer', type: 'CPassengerActor *', location: 'esi' },
          { oldName: 'v2', name: 'fSecondsLeft', type: 'float', location: 'xmm0_4' },
          { oldName: 'v3', name: 'fBonusSeconds', type: 'float', location: 'xmm1_4' }
        ],
        bodyLines: [
          'pCustomer = pCab->pCurrentPassenger;',
          'fSecondsLeft = pCustomer->fCustomerPatienceTimer;',
          'if ( fSecondsLeft >= pCustomer->fSpeedyThresholdSec )',
          '{',
          '  fBonusSeconds = 5.0f;',
          '  Hud_ShowSpeedyBanner_00463C80(RATING_SPEEDY_PLUS_5_SEC);',
          '}',
          'else if ( fSecondsLeft >= pCustomer->fNormalThresholdSec )',
          '{',
          '  fBonusSeconds = 2.0f;',
          '  Hud_ShowSpeedyBanner_00463C80(RATING_NORMAL_PLUS_2_SEC);',
          '}',
          'else',
          '{',
          '  fBonusSeconds = 0.0f;',
          '  Hud_ShowSpeedyBanner_00463C80(RATING_SLOW_NO_BONUS);',
          '}',
          'g_fMatchCountdownTimer_00591034 += fBonusSeconds;',
          'g_TotalSessionCash_00594B00 += pCustomer->fBaseFarePrice;',
          'pCab->pCurrentPassenger = 0;',
          'return 1;'
        ],
        comment: 'Evaluates Speedy (+5s), Normal (+2s), or Slow (+0s) delivery rating, adds base fare to total cash, and releases passenger.'
      },
      {
        name: 'PassengerManager_SetFareRingColorByDistance',
        params: 'CPassengerActor *pCustomer, float fRouteDistanceMeters',
        vars: [
          { oldName: 'a1', name: 'pCustomer', type: 'CPassengerActor *', location: 'ebp+0x08' },
          { oldName: 'v2', name: 'uRgbaColor', type: 'unsigned int', location: 'eax' }
        ],
        bodyLines: [
          'if ( fRouteDistanceMeters > 650.0f )',
          '  uRgbaColor = 0xFF00FF40; // Green Ring (Long high-paying fare)',
          'else if ( fRouteDistanceMeters > 320.0f )',
          '  uRgbaColor = 0xFFFFE600; // Yellow Ring (Medium fare)',
          'else',
          '  uRgbaColor = 0xFFFF2814; // Red Ring (Short fare)',
          'pCustomer->uRingColorRGBA = uRgbaColor;',
          'return uRgbaColor;'
        ],
        comment: 'Assigns the iconic Green, Yellow, or Red overhead customer marker color based on destination distance.'
      }
    ]
  },
  {
    baseAddr: 0x00458000,
    count: 210,
    stride: 0x88,
    prefix: 'TrafficAI',
    className: 'CTrafficVehicleAI',
    tag: 'Traffic',
    callingConv: '__cdecl',
    returnType: 'void',
    isRenamedRatio: 0.64,
    namedRoutines: [
      {
        name: 'TrafficAI_AdvanceAlongRoadSpline',
        params: 'CTrafficVehicle *pTraffic, float fDeltaStep',
        vars: [
          { oldName: 'a1', name: 'pTraffic', type: 'CTrafficVehicle *', location: 'esi' },
          { oldName: 'v2', name: 'pSpline', type: 'SRoadSplineSegment *', location: 'edi' },
          { oldName: 'v3', name: 'fParamT', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'pSpline = pTraffic->pCurrentRoadSpline;',
          'fParamT = pTraffic->fSplineProgressT + (pTraffic->fCruiseSpeed * pSpline->fInvLength * fDeltaStep);',
          'if ( fParamT >= 1.0f )',
          '{',
          '  pTraffic->pCurrentRoadSpline = pSpline->pNextConnectedSpline;',
          '  fParamT -= 1.0f;',
          '}',
          'pTraffic->fSplineProgressT = fParamT;',
          'Math_EvalHermiteSplinePos_00409540(pTraffic->pCurrentRoadSpline, fParamT, &pTraffic->vPos);'
        ],
        comment: 'Moves ambient traffic cars and San Francisco cable cars along cubic Hermite road splines.'
      },
      {
        name: 'TrafficAI_CheckNearMissCrazyThrough',
        params: 'CTaxiPhysicsBody *pCab, CTrafficVehicle *pTraffic',
        vars: [
          { oldName: 'v1', name: 'fClearanceDist', type: 'float', location: 'xmm0_4' },
          { oldName: 'v2', name: 'fRelativeSpeed', type: 'float', location: 'xmm1_4' }
        ],
        bodyLines: [
          'if ( (pTraffic->uFlags & TRAFFIC_FLAG_ALREADY_PASSED) == 0 )',
          '{',
          '  fClearanceDist = Math_TestOBBClearance_00409820(&pCab->obbBounds, &pTraffic->obbBounds);',
          '  fRelativeSpeed = fabs(pCab->fForwardSpeed - pTraffic->fCruiseSpeed);',
          '  if ( fClearanceDist > 0.05f && fClearanceDist < 1.65f && fRelativeSpeed > 45.0f )',
          '  {',
          '    pTraffic->uFlags |= TRAFFIC_FLAG_ALREADY_PASSED;',
          '    pCab->bJustCompletedCrazyThrough = 1;',
          '  }',
          '}'
        ],
        comment: 'Detects high-speed near misses between the player taxi and ambient vehicles to award a Crazy Through combo.'
      }
    ]
  },
  {
    baseAddr: 0x00462000,
    count: 190,
    stride: 0x80,
    prefix: 'Hud_And_CrazyBox',
    className: 'CHudOverlayManager',
    tag: 'HUD',
    callingConv: '__cdecl',
    returnType: 'void',
    isRenamedRatio: 0.70,
    namedRoutines: [
      {
        name: 'Hud_DrawGreenArrowAndSpeedometer',
        params: 'void',
        vars: [
          { oldName: 'v1', name: 'mArrowRot', type: 'NJS_MATRIX', location: 'ebp-0x40' },
          { oldName: 'v2', name: 'fPulseScale', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'if ( g_pActivePlayerCab_00594A10 && g_pActivePlayerCab_00594A10->pCurrentPassenger )',
          '{',
          '  njUnitMatrix(mArrowRot);',
          '  njRotateY(mArrowRot, (Angle)(g_GreenDestinationArrowYaw_00595140 * 10430.378f));',
          '  fPulseScale = 1.0f + (sinf(g_fHudAnimPhase_00591040) * 0.08f);',
          '  njScale(mArrowRot, fPulseScale, fPulseScale, fPulseScale);',
          '  njDrawModel_00491420(&g_GreenArrowModel_00578100);',
          '}',
          'Hud_RenderCashAndTimerDigits_00462A90();'
        ],
        comment: 'Renders the 3D pulsing Green Destination Arrow at the top center of the viewport using Sega Ninja matrix ops.'
      },
      {
        name: 'Hud_CalculateFinalClassLicenseRank',
        params: 'float fTotalEarnedDollars',
        vars: [
          { oldName: 'a1', name: 'fTotalEarnedDollars', type: 'float', location: 'ebp+0x08' },
          { oldName: 'v1', name: 'eLicenseRank', type: 'int', location: 'eax' }
        ],
        bodyLines: [
          'if ( fTotalEarnedDollars >= 20000.0f )',
          '  eLicenseRank = LICENSE_CRAZY;',
          'else if ( fTotalEarnedDollars >= 10000.0f )',
          '  eLicenseRank = LICENSE_CLASS_S;',
          'else if ( fTotalEarnedDollars >= 5000.0f )',
          '  eLicenseRank = LICENSE_CLASS_A;',
          'else if ( fTotalEarnedDollars >= 3000.0f )',
          '  eLicenseRank = LICENSE_CLASS_B;',
          'else if ( fTotalEarnedDollars >= 2000.0f )',
          '  eLicenseRank = LICENSE_CLASS_C;',
          'else if ( fTotalEarnedDollars >= 1000.0f )',
          '  eLicenseRank = LICENSE_CLASS_D;',
          'else',
          '  eLicenseRank = LICENSE_CLASS_E;',
          'g_LastAwardedLicenseClass_00594B08 = eLicenseRank;'
        ],
        comment: 'Computes the end-of-run driver license rating (CRAZY, S, A, B, C, D, E) based on total fare + tip cash.'
      }
    ]
  },
  {
    baseAddr: 0x00472000,
    count: 340,
    stride: 0x70,
    prefix: 'NinjaSDK_D3D8',
    className: 'CD3D8RenderDevice',
    tag: 'NinjaSDK',
    callingConv: '__cdecl',
    returnType: 'int',
    isRenamedRatio: 0.75,
    namedRoutines: [
      {
        name: 'njSetPerspective_ProjectionMatrix',
        params: 'Angle nHorizontalFovBams, float fAspectRatio',
        vars: [
          { oldName: 'a1', name: 'nHorizontalFovBams', type: 'int', location: 'ebp+0x08' },
          { oldName: 'a2', name: 'fAspectRatio', type: 'float', location: 'ebp+0x0C' },
          { oldName: 'v3', name: 'fCotHalfFov', type: 'float', location: 'xmm0_4' }
        ],
        bodyLines: [
          'fCotHalfFov = 1.0f / tanf((float)nHorizontalFovBams * 0.0000958738f * 0.5f);',
          'g_ProjectionMatrix_005B0300._11 = fCotHalfFov / fAspectRatio;',
          'g_ProjectionMatrix_005B0300._22 = fCotHalfFov;',
          'g_ProjectionMatrix_005B0300._33 = g_fFarClip_005B0340 / (g_fFarClip_005B0340 - g_fNearClip_005B033C);',
          'IDirect3DDevice8_SetTransform(g_pD3D8Device_005B0200, D3DTS_PROJECTION, &g_ProjectionMatrix_005B0300);',
          'return 1;'
        ],
        comment: 'Sega Dreamcast Ninja SDK njSetPerspective implementation wrapped over Direct3D8 SetTransform(D3DTS_PROJECTION).'
      },
      {
        name: 'njLoadTexturePVM_UnpackVQ',
        params: 'const char *szPvmFileName, NJS_TEXLIST *pTexList',
        vars: [
          { oldName: 'a1', name: 'szPvmFileName', type: 'const char *', location: 'ebp+0x08' },
          { oldName: 'a2', name: 'pTexList', type: 'NJS_TEXLIST *', location: 'ebp+0x0C' },
          { oldName: 'v3', name: 'hFile', type: 'HANDLE', location: 'esi' }
        ],
        bodyLines: [
          'hFile = FileSystem_OpenArchiveFile_00406100(szPvmFileName);',
          'if ( hFile == INVALID_HANDLE_VALUE )',
          '  return 0;',
          'if ( !PvmParser_DecodePVRTexturesToD3D8_0047C410(hFile, pTexList) )',
          '{',
          '  CloseHandle(hFile);',
          '  return -1;',
          '}',
          'CloseHandle(hFile);',
          'return 1;'
        ],
        comment: 'Loads Dreamcast PVM/PVR vector-quantized (VQ) texture archives and uploads them as Direct3D8A surfaces.'
      },
      {
        name: 'WorldOctree_RenderVisibleCityChunks',
        params: 'SCameraFrustum *pCamera',
        vars: [
          { oldName: 'a1', name: 'pCamera', type: 'SCameraFrustum *', location: 'ebp+0x08' },
          { oldName: 'v2', name: 'iSector', type: 'int', location: 'edi' },
          { oldName: 'v3', name: 'nDrawnChunks', type: 'int', location: 'ebx' }
        ],
        bodyLines: [
          'nDrawnChunks = 0;',
          'for ( iSector = 0; iSector < g_nCitySectorCount_005B1000; ++iSector )',
          '{',
          '  if ( Frustum_TestSphereVisibility_00473820(pCamera, &g_CitySectors_005B1010[iSector].boundingSphere) )',
          '  {',
          '    njDrawChunkModel_00491800(g_CitySectors_005B1010[iSector].pChunkMesh);',
          '    ++nDrawnChunks;',
          '  }',
          '}',
          'return nDrawnChunks;'
        ],
        comment: 'Performs view-frustum culling over West Coast / Arcade city districts (Cable Car Hill, Chinatown, Freeway, Beach).'
      }
    ]
  },
  {
    baseAddr: 0x0048A000,
    count: 195,
    stride: 0x78,
    prefix: 'CRI_ADX_Audio',
    className: 'CCriAdxAudioStream',
    tag: 'CRI_ADX',
    callingConv: '__cdecl',
    returnType: 'int',
    isRenamedRatio: 0.65,
    namedRoutines: [
      {
        name: 'CRI_AdxDecodeBlock4BitADPCM',
        params: 'CRI_ADX_STREAM *pStream, short *pOutPcmStereo, int nFrames',
        vars: [
          { oldName: 'a1', name: 'pStream', type: 'CRI_ADX_STREAM *', location: 'esi' },
          { oldName: 'v3', name: 'nScale', type: 'int', location: 'ecx' },
          { oldName: 'v4', name: 'iSample', type: 'int', location: 'edi' }
        ],
        bodyLines: [
          'nScale = ((pStream->pAdxFrameBuf[0] << 8) | pStream->pAdxFrameBuf[1]) + 1;',
          'for ( iSample = 0; iSample < 32; ++iSample )',
          '{',
          '  pOutPcmStereo[iSample] = CRI_Clamp16Bit_0048D600((pStream->nNibble * nScale) + pStream->nPrevSample1);',
          '}',
          'return 32;'
        ],
        comment: 'Decodes CRI Middleware 4-bit ADX audio frames into 16-bit 44.1kHz PCM for DirectSound8 playback.'
      },
      {
        name: 'Audio_PlayPassengerVoiceClip',
        params: 'int nVoiceBankId, int nPhraseIndex',
        vars: [
          { oldName: 'a1', name: 'nVoiceBankId', type: 'int', location: 'ebp+0x08' },
          { oldName: 'a2', name: 'nPhraseIndex', type: 'int', location: 'ebp+0x0C' }
        ],
        bodyLines: [
          'if ( !g_bVoiceEffectsEnabled_0058C158 )',
          '  return 0;',
          'if ( nVoiceBankId < 0 || nVoiceBankId >= 16 )',
          '  return -1;',
          'return DirectSound_PlaySecondaryBuffer_0048B400(g_VoiceBanks_005B9000[nVoiceBankId].pWaveBuffers[nPhraseIndex]);'
        ],
        comment: 'Plays passenger voice lines ("Hey Taxi!", "Yah yah yah!", "Come on, hurry up!").'
      }
    ]
  },
  {
    baseAddr: 0x004A0000,
    count: 310,
    stride: 0x60,
    prefix: 'Unanalyzed_Sub',
    className: undefined,
    tag: 'sub_Routine',
    callingConv: '__cdecl',
    returnType: 'int',
    isRenamedRatio: 0.12,
    namedRoutines: [
      {
        name: 'Math_SinCosLookupBAMS',
        params: 'Angle nBamsAngle, float *pOutSin, float *pOutCos',
        vars: [
          { oldName: 'a1', name: 'nBamsAngle', type: 'int', location: 'ebp+0x08' },
          { oldName: 'v2', name: 'uTableIndex', type: 'unsigned int', location: 'eax' }
        ],
        bodyLines: [
          'if ( !pOutSin || !pOutCos )',
          '  return 0;',
          'uTableIndex = (unsigned int)nBamsAngle >> 4 & 0xFFF;',
          '*pOutSin = g_NinjaSinTable_0057A000[uTableIndex];',
          '*pOutCos = g_NinjaCosTable_0057E000[uTableIndex];',
          'return (int)uTableIndex;'
        ],
        comment: 'Fast 16-bit BAMS (Binary Angular Measurement System) lookup table used by Dreamcast SH-4 port routines.'
      },
      {
        name: 'CRT_FastMemcpyAligned16',
        params: 'void *pDst, const void *pSrc, unsigned int uSizeBytes',
        vars: [
          { oldName: 'a1', name: 'pDst', type: 'void *', location: 'edi' },
          { oldName: 'a2', name: 'pSrc', type: 'const void *', location: 'esi' },
          { oldName: 'a3', name: 'uSizeBytes', type: 'unsigned int', location: 'ecx' }
        ],
        bodyLines: [
          'if ( !pDst || !pSrc || !uSizeBytes )',
          '  return 0;',
          'qmemcpy(pDst, pSrc, uSizeBytes);',
          'return (int)pDst;'
        ],
        comment: 'MSVC 6.0 / Katana SDK aligned memory block copy.'
      }
    ]
  }
];

export function buildFullCrazyTaxiFunctionList(
  coreFunctions: DecompiledFunction[]
): DecompiledFunction[] {
  const enrichedCore = coreFunctions.map((fn) => {
    const dynamicCfg = buildDynamicCfgFromPseudocode(fn.address, fn.name, fn.pseudocode);
    const { className, methodName } = inferClassAndMethod(
      fn.name,
      fn.demangledName,
      fn.callingConvention
    );
    return {
      ...fn,
      className: fn.className || className,
      methodName: fn.methodName || methodName,
      cfgNodes: dynamicCfg.cfgNodes.length > fn.cfgNodes.length ? dynamicCfg.cfgNodes : fn.cfgNodes,
      cfgEdges: dynamicCfg.cfgNodes.length > fn.cfgNodes.length ? dynamicCfg.cfgEdges : fn.cfgEdges,
    };
  });

  const allFunctions: DecompiledFunction[] = [...enrichedCore];
  const existingAddresses = new Set(enrichedCore.map((f) => f.address.toUpperCase()));

  let globalIndex = enrichedCore.length;

  for (const cat of CRAZY_TAXI_SUBSYSTEM_CATALOG) {
    for (let i = 0; i < cat.count; i++) {
      const ea = cat.baseAddr + i * cat.stride;
      const addrHex = '0x' + ea.toString(16).toUpperCase().padStart(8, '0');
      const shortHex = ea.toString(16).toUpperCase().padStart(6, '0');

      if (existingAddresses.has(addrHex)) {
        continue;
      }
      existingAddresses.add(addrHex);

      const template = cat.namedRoutines[i % cat.namedRoutines.length];
      const deterministicHash = ((i * 2654435761) >>> 0) % 100;
      const isRenamed = deterministicHash < cat.isRenamedRatio * 100;

      const funcName = isRenamed
        ? i < cat.namedRoutines.length
          ? `${template.name}_${shortHex}`
          : `${cat.prefix}_${template.name.split('_').pop()}_${shortHex}`
        : `sub_${shortHex}`;

      const assignedClass = isRenamed ? cat.className : undefined;
      const methodOnly = assignedClass
        ? funcName.replace(/^([A-Za-z0-9]+)_/, '')
        : funcName;

      const signature = `${cat.returnType} ${cat.callingConv} ${funcName}(${template.params})`;

      const varDeclarations = template.vars.map(
        (v) => `  ${v.type} ${v.name}; // [${v.location}]${v.comment ? ' ' + v.comment : ''}`
      );

      const pseudocode: string[] = [
        `//----- (${shortHex}) --------------------------------------------------------`,
        signature,
        `{`,
        ...varDeclarations,
        ``,
        ...template.bodyLines.map((l) => `  ${l}`),
        `}`
      ];

      const { cfgNodes, cfgEdges } = buildDynamicCfgFromPseudocode(addrHex, funcName, pseudocode);

      allFunctions.push({
        id: `fn_${shortHex}_${globalIndex++}`,
        address: addrHex,
        name: funcName,
        className: assignedClass,
        methodName: methodOnly,
        demangledName: assignedClass ? `${assignedClass}::${methodOnly}` : signature,
        segment: '.text',
        returnType: cat.returnType,
        callingConvention: cat.callingConv,
        signature,
        sizeBytes: cat.stride - 8,
        localVariables: template.vars,
        pseudocode,
        cfgNodes,
        cfgEdges,
        xrefsTo: [
          {
            address: '0x004128C0',
            funcName: 'GameMain_FrameTick_004128C0',
            type: 'CALL'
          }
        ],
        xrefsFrom: [],
        comments: isRenamed
          ? `${template.comment} (IDA .i64 RVA ${addrHex})`
          : `Unbenannte IDA Pro Subroutine sub_${shortHex} @ ${addrHex} im Segment .text. / Unnamed IDA Pro subroutine.`,
        tags: isRenamed ? [cat.tag, 'Renamed'] : [cat.tag, 'sub_Routine'],
        isRenamed
      });
    }
  }

  allFunctions.sort((a, b) => {
    const addrA = parseInt(a.address.replace(/^0x/i, ''), 16) || 0;
    const addrB = parseInt(b.address.replace(/^0x/i, ''), 16) || 0;
    return addrA - addrB;
  });

  return allFunctions;
}