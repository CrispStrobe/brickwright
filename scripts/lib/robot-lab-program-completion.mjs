// SPDX-License-Identifier: BSD-3-Clause
// Completion is stricter than a finite smoke run. Unreviewed output contracts stay gaps.
export const PROGRAM_OUTPUT_CONTRACTS = {
    'toggle-lever': {terminal: 'completed', part: 'jaw_lever', description: 'Passive jaw lever arc and return to saved pose', minTravelM: 0.001, drive: 'commanded-motion', terminalValues: {stage: 4}, message: 'ToggleLever complete: compare the passive lever arc with the link closure.'},
    'cross-ratio': {terminal:'completed',part:'output_beam',relativeTo:'base_cross_-120',description:'Passive crossed-linkage output rotation',minRotationDeg:0.1,drive:'commanded-motion',terminalValues:{stage:10,movingMask:0},message:'Complete: compare the crossed half-angle relation and changing gain. Input A holds at its saved datum.'},
    'kestrel-flapper': {terminal:'completed',outputs:[{part:'wing_spine',relativeTo:'bearing_plate_40',minTravelM:0.001},{part:'rocker',relativeTo:'bearing_plate_40',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:5},message:'Kestrel complete: two forward and two reverse wing strokes. Reset to repeat.'},
    'lumen-iris': {terminal:'completed',outputs:Array.from({length:6},(_,i)=>({part:'leaf_plate_'+i,relativeTo:'ring_race',minTravelM:0.001})),drive:'commanded-motion',terminalValues:{stage:11,cycle:2,targetDegrees:0},message:'Lumen complete: two open-close cycles. Reset to repeat.'},
    'paired-door-sync': {terminal:'completed',outputs:['rack_front','rack_back'].map(part=>({part,relativeTo:'base_cross_front',minTravelM:0.001})),drive:'commanded-motion',terminalValues:{stage:5,targetA:0,settled:0},message:'Paired-door run complete: compare both passive rack markers and the sum law.'},
    'travel-dial': {terminal:'completed',outputs:[{part:'sled_deck',relativeTo:'guide_-60_axle',minTravelM:0.001},{part:'wheel',relativeTo:'guide_-60_axle',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:7,targetA:0},message:'Complete: the crank is held home. Compare passive wheel motion with sled travel.'},
    'ghost-pivot': {terminal:'completed',outputs:[{part:'tool_link',relativeTo:'ground_bearing',minRotationDeg:0.1},{part:'tool_link',localPointLdu:[0,0,-100],relativeTo:'ground_bearing',observeOnly:true}],drive:'commanded-motion',terminalValues:{stage:7,targetA:0},message:'Complete: the input is held home. Compare tool heading with motion of its empty R hole.'},
    'air-budget': {terminal:'complete',outputs:[{part:'pump_rod',relativeTo:'pump_body',minTravelM:0.001},{type:'air-pressure',requireRise:true}],drive:'commanded-motion',terminalValues:{stage:2,targetA:0,settled:0},message:'Air Budget complete: compare the pressure rise after the same six pump strokes.'},
    'impulse-line': {terminal:'completed',outputs:['left','middle','right'].map(side=>({part:'pendulum_'+side+'_bob_key',relativeTo:'bridge_rail',minTravelM:0.001})),drive:'commanded-motion',terminalValues:{stage:5,observing:0,pulsing:0,targetA:0},message:'Complete: the pusher is held home; passive bobs may still ring down.'},
    'final-squeeze': {terminal:'completed',outputs:[{part:'platen_crossbar',relativeTo:'floor_mechanism_left',minTravelM:0.001},{part:'shock_rod',relativeTo:'shock_cylinder',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:12,targetA:0,settled:0},message:'Final Squeeze complete: the platen pressed, released and returned home.'},
    afterturn: {terminal:'completed',outputs:[{part:'yaw_top',relativeTo:'yaw_bottom',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:8,targetA:0,targetB:0},message:'Complete: compare first-cycle and inverse-cycle platform headings. Both internal coordinates are home.'},
    'quiet-partner': {terminal:'complete',outputs:['primary_axle','absorber_axle'].map(part=>({part,relativeTo:'lower_rail_neg',minRotationDeg:0.1})),drive:'commanded-motion',terminalValues:{phase:4,cycle:16,half:0,target:0},message:'Complete. Compare the primary motion with and without the partner bands. Reload before the other run.'},
    'high-select': {terminal:'complete',outputs:['input_A_pad','input_B_pad','bridge_A_foot','bridge_B_foot'].map(part=>({part,relativeTo:'floor_back_beam_0',minTravelM:0.001})),drive:'commanded-motion',terminalValues:{stage:10,settled:0,targetA:0,targetB:0,targetHeightA:0,targetHeightB:0},message:'High Select complete: compare measured input heights and the passive bridge at each hold.'},
    foldback: {terminal:'completed',outputs:[{part:'output_arm',relativeTo:'D_bearing_upper',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:7,held:1,targetA:0},message:'Complete. A holds at its original datum; the output remains passive.'},
    thirdline:{terminal:'completed',outputs:[{part:'ruler_mark_beam',relativeTo:'guide_base_rail_-240_100',minRotationDeg:0.1},...['a_cross','c_cross'].map(part=>({part,relativeTo:'guide_base_rail_-240_100',minTravelM:0.001}))],drive:'commanded-motion',terminalValues:{stage:7,held:1,targetA:0},message:'Complete. A holds its original datum; the ruler and sliders remain passive.'},
    rimrun:{terminal:'completed',outputs:['left_wheel_-1','right_wheel_-1'].map(part=>({part,relativeTo:'track_left_0_0',minTravelM:0.001,minRotationDeg:0.1})),drive:'commanded-motion',terminalValues:{stage:4,homed:1,arrivals:2,targetA:0},message:'Gate returned. Reload the model before running the swapped lane order.'},
    swayshift:{terminal:'completed',outputs:[{part:'trolley_crossbeam',relativeTo:'base_frame_left',minTravelM:0.001},{part:'pendulum_lower',relativeTo:'pendulum_support',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:5,arrivals:3,targetA:0},message:'Transfer and return complete. Reload the model before trying the other timing.'},
    tipline:{terminal:'completed',outputs:[...['left_load_base','right_load_base'].map(part=>({part,relativeTo:'deck_edge_rail_-150_main',observeOnly:true})),{part:'deck_edge_rail_-150_main',relativeTo:'base_frame_left',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:4,held:1,targetA:0},message:'Deck returned. Reload the model before comparing the ballast swap.'},
    evenhand:{terminal:'completed',outputs:[{part:'forearm',relativeTo:'base_cross_80',minTravelM:0.001},{part:'upper_arm_-20',relativeTo:'base_cross_80',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:10,phase:3,arrivals:11,targetA:0,targetB:0},message:'Nine poses and return complete. Reload the comparison model to move the same weights inward.'},
    'toggle-press':{terminal:'done',part:'slider_cross',localPointLdu:[0,0,0],relativeTo:'support_rail_60',referencePointLdu:[0,0,0],minTravelM:0.001,drive:'commanded-motion',terminalValues:{phase:99,targetA:0},message:'Toggle Press cycle complete. Compare ram travel and reset before repeating.'},
    'pivot-exchange':{terminal:'complete',outputs:['arm_near_beam','arm_far_beam','arm_control_beam'].map(part=>({part,relativeTo:'floor_back_-140',minRotationDeg:0.1})),drive:'passive',terminalValues:{observing:0},message:'Observation complete. The two nearly conjugate suspensions should keep similar time; the central-hole control swings more slowly.'},
    'sarrus-lift-single-chain':{terminalMode:'natural-exit-message',outputs:[{part:'deck_plate',relativeTo:'baseplate',observeOnly:true}],drive:'intentional-hold',requiredOpcodes:{robotlab_startSimulation:1,robotlab_stopMotor:1},message:'Single-chain control complete: compare the deck with the full Sarrus Lift.'},
    helixgate:{terminalMode:'finite-route',outputs:[{part:'wheel_24',relativeTo:'base_cross',minRotationDeg:0.1},{part:'blue_tip',relativeTo:'base_cross',minTravelM:0.001}],drive:'commanded-motion',requiredOpcodes:{robotlab_runMotorDegrees:2,robotlab_stopMotor:5},forbiddenOpcodes:['control_stop']},
    looprelay:{terminalMode:'finite-route',outputs:[{part:'indicator_hand',relativeTo:'base_cross',minRotationDeg:0.1},{part:'axle_mid',relativeTo:'base_cross',minRotationDeg:0.1}],drive:'commanded-motion',requiredOpcodes:{robotlab_runMotorDegrees:2,robotlab_stopMotor:4},forbiddenOpcodes:['control_stop']},
    paritydial:{terminalMode:'finite-route',outputs:['dial_left','dial_right'].map(part=>({part,relativeTo:'base_cross',minRotationDeg:0.1})),drive:'commanded-motion',requiredOpcodes:{robotlab_runMotorDegrees:3,robotlab_stopMotor:5},forbiddenOpcodes:['control_stop']},
    counterslide:{terminalMode:'finite-route',outputs:['jaw_high','jaw_low','rack_high','rack_low'].map(part=>({part,relativeTo:'motor_mount_beam',minTravelM:0.001})),drive:'commanded-motion',requiredOpcodes:{robotlab_runMotorDegrees:2,robotlab_stopMotor:4},forbiddenOpcodes:['control_stop']},
    apex:{terminal:'completed',outputs:['rotor_hub','carrier_rear_cross'].map(part=>({part,relativeTo:'base_long_-20',minRotationDeg:0.1})),drive:'commanded-motion',terminalValues:{stage:4,settled:1,target:0},message:'Complete: one passive rotor turn out and back. Motor A holds home.'},
    bloom:{terminal:'completed',outputs:['XY','YZ','ZX'].map(axis=>({type:'distance',parts:['cage_'+axis+'_00_B_end_start','cage_'+axis+'_04_B_end_start'],minRangeM:0.001})),drive:'commanded-motion',terminalValues:{stage:5},message:'Bloom cycle complete. The measured inner cage span has returned home; motor A holds.'},
    'vector-delta':{terminal:'completed',part:'tool_star',relativeTo:'hub',minTravelM:0.001,drive:'commanded-motion',terminalValues:{waypoint:12,atTarget:1},message:'Vector complete: three stations visited, tool head home, all three motors holding.'},
    'tempest-pendulum':{terminal:'completed',outputs:[{part:'upper_arm',relativeTo:'carrier_bearing',minRotationDeg:0.1},{part:'lower_arm',relativeTo:'upper_arm',minRotationDeg:0.1},{part:'upper_bob_wheel',relativeTo:'carrier_bearing',minTravelM:0.001},{part:'lower_bob_wheel',relativeTo:'upper_arm',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:4,phase:'complete',moving:0,trimStage:0,observationWindow:0,targetDegrees:0},message:'Tempest complete. The carrier is home; Reset to repeat the experiment.'},
    'equal-share':{terminal:'completed',outputs:[{part:'equalizer',relativeTo:'base_cross_left_120',minTravelM:0.001},...['left','right_front','right_back'].map(side=>({part:side+'_rod',relativeTo:side+'_cylinder',minTravelM:0.001}))],drive:'commanded-motion',terminalValues:{stage:6,targetA:0,dwelling:0},message:'Complete: compare the held shock compressions and the return to zero.'},
    'equinox-differential':{terminal:'completed',outputs:['sideL','sideR','casing'].map(part=>({part,relativeTo:'base_cross_-20',minRotationDeg:0.1})),drive:'commanded-motion',passiveBrakePorts:['B','C'],terminalValues:{stage:5},message:'Equinox complete: free, right held, left held, and reverse. Reset to repeat.'},
    'obliquity-orrery':{terminal:'completed',outputs:[{part:'earth_axle',relativeTo:'base_rail_1',minTravelM:0.001},{part:'earth_axle',localPointLdu:[-100,0,0],relativeTo:'base_rail_1',observeOnly:true},{part:'earth',relativeTo:'base_rail_1',observeOnly:true},{part:'coupler',relativeTo:'base_rail_1',minTravelM:0.001},{part:'sun_marker',relativeTo:'base_rail_1',observeOnly:true}],drive:'commanded-motion',terminalValues:{stage:99,settled:0,targetA:0},message:'Orrery complete: compare the measured declination with sin(delta)=sin(22.5)*cos(lambda-45).'},
    'spiral-scribe':{terminal:'completed',outputs:[{type:'distance',parts:['output_marker','carrier_base'],minRangeM:0.001},{part:'output_marker',relativeTo:'foundation_plate_-20',minTravelM:0.001},{part:'carrier_end_crossbar',relativeTo:'foundation_plate_-20',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{phase:10,cycle:2,targetA:0},message:'Spiral Scribe complete. Compare the two speeds and the measured radial feed.'},
    'schmidt-shift':{terminal:'completed',outputs:['input_frame','middle_frame','output_frame'].map(part=>({part,relativeTo:'output_bearing_-300',minRotationDeg:0.1})),drive:'commanded-motion',terminalValues:{stage:4,targetA:0},message:'Complete: offset output followed both directions and returned home.'},
    poise:{terminal:'completed',outputs:[...['upper_bar','lower_bar','left_pan_frame','right_pan_frame'].map(part=>({part,relativeTo:'base_cross_120',observeOnly:true})),{part:'left_weight',relativeTo:'left_pan_frame',minTravelM:0.001},{part:'right_weight',relativeTo:'right_pan_frame',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:6,targetA:0,targetB:0},message:'Complete: compare the five held balance observations and the returned weights.'},
    'carry-ratio':{terminal:'completed',outputs:[{part:'tray_deck',relativeTo:'base_plate',minTravelM:0.001},{part:'roller_ball',relativeTo:'tray_deck',minRotationDeg:0.1},{part:'roller_ball',relativeTo:'base_plate',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:7,settled:1,targetA:0},message:'Carry Ratio complete: compare the deck, the free roller and the tray acceleration.'},
    'helios-transmission':{terminal:'completed',outputs:[{part:'output_pointer',relativeTo:'motor_deck_spacer_100_0',minRotationDeg:0.1},{part:'output_tip',relativeTo:'motor_deck_spacer_100_0',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:8,returnedA:1,returnedB:1},message:'Helios complete: forward, neutral, reverse and return. Reset to repeat.'},
    'meridian-linkage':{terminal:'completed',part:'marker_output',relativeTo:'fixed_O_bearing',minTravelM:0.001,drive:'commanded-motion',terminalValues:{stage:7,moving:0,targetDegrees:0},message:'Meridian complete: slow sweep, repeat, reverse and home. Reset to repeat.'},
    'phasor-twin':{terminal:'completed',outputs:['A','B'].map(side=>({part:'pistonrod_'+side,relativeTo:'cylinder_'+side,minTravelM:0.001})),drive:'commanded-motion',terminalValues:{stage:3,settled:0,targetA:0},message:'Phasor Twin complete: compare the two passive piston traces.'},
    'solstice-pumpjack':{terminal:'completed',outputs:[{part:'walking_beam',relativeTo:'base_cross_piston',minRotationDeg:0.1},{part:'pump_rod',relativeTo:'base_cross_piston',minTravelM:0.001},{part:'piston_rack',relativeTo:'base_cross_piston',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:7,moving:0,targetDegrees:0},message:'Solstice complete: slow cycle, reverse, repeat and home. Reset to repeat.'},
    'offset-relay':{terminal:'completed',outputs:[...['input_beam_x','middle_front_beam_x','output_beam_x'].map(part=>({part,relativeTo:'input_bearing',minRotationDeg:0.1})),{part:'output_bearing',relativeTo:'input_bearing',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:9,arrived:0,movingMask:0},message:'Complete: compare actual input, middle and output angles throughout the changing offset. Both inputs hold.'},
    'rack-decoder':{terminal:'completed',outputs:[...['rack_A','rack_B','carrier_bearing'].map(part=>({part,relativeTo:'base_angle_front_-1',minTravelM:0.001})),...['passive_pinion','passive_pointer'].map(part=>({part,relativeTo:'base_angle_front_-1',minRotationDeg:0.1}))],drive:'commanded-motion',terminalValues:{stage:9,arrived:0,movingMask:0},message:'Complete: compare the actual passive carrier translation and pinion rotation. Both rack inputs hold.'},
    'cadence-geneva':{terminal:'completed',outputs:['star_center','dial_hand_tip'].map(part=>({part,relativeTo:'hub',minRotationDeg:0.1})),drive:'commanded-motion',terminalValues:{ticks:12},message:'Cadence complete: twelve mechanical dial steps, one full dial revolution.'},
    'aster-governor':{terminal:'completed',outputs:[{type:'axis-projection',part:'collar',axisPart:'spindle',axisLocalLdu:[-100,0,0],observeOnly:true},...['flyweight_pos','flyweight_neg'].map(part=>({type:'radial-distance',part,axisPart:'spindle',axisLocalLdu:[-100,0,0],observeOnly:true}))],drive:'commanded-motion',terminalValues:{stage:17,driveSpeed:0},message:'Aster complete: speed response, repeatability and gravity return. Reset to repeat.'},
    'orion-cardan':{terminal:'completed',outputs:['shaft_input','shaft_middle','shaft_output'].map(part=>({part,relativeTo:'input_rear_bearing',minRotationDeg:0.1})),drive:'commanded-motion',terminalValues:{stage:19},message:'Orion complete: ripple, cancellation, reverse, restart and return. Reset to repeat.'},
    'tangent-table':{terminal:'completed',outputs:[{part:'output_carriage',relativeTo:'hub',minTravelM:0.001},{part:'follower_key',relativeTo:'hub',minTravelM:0.001},{part:'angle_hub',relativeTo:'hub',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:8,arrived:0,movingMask:0},message:'Complete: compare signed gain and the two equal-output endpoints. Both inputs hold.'},
    'stroke-shift':{terminal:'completed',outputs:[{part:'output_marker',relativeTo:'foundation_plate_-20',minTravelM:0.001},{part:'piston_slide_-40',relativeTo:'foundation_plate_-20',minTravelM:0.001},{part:'adjuster_slide_cross_40',relativeTo:'carrier_ring',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:6,targetA:0,targetB:0},message:'Stroke Shift complete: three crank radii compared; both inputs home and held.'},
    'vesper-quickreturn':{terminal:'completed',part:'ram_rack',relativeTo:'base_cross_ram',minTravelM:0.001,drive:'commanded-motion',terminalValues:{stage:4,moving:0,targetDegrees:0},message:'Vesper complete: slow and fast cycles in both directions, then home. Reset to repeat.'},
    'inertia-loop':{terminal:'completed',outputs:[{part:'yaw_platform',relativeTo:'yaw_base',observeOnly:true},...['rotor_beam_x','rotor_beam_z'].map(part=>({part,relativeTo:'yaw_platform',minRotationDeg:0.1})),{part:'ballast_z_-1_0',relativeTo:'yaw_platform',observeOnly:true}],drive:'commanded-motion',terminalValues:{stage:11,arrived:0,movingMotor:0},message:'Complete: compare each case with its own starting heading. Both inputs hold; platform yaw remains free.'},
    'triad-table':{terminal:'completed',outputs:[{part:'platform_pointer',relativeTo:'foundation_plate_-60',minTravelM:0.001,minRotationDeg:0.1},{part:'platform_tip',relativeTo:'foundation_plate_-60',observeOnly:true}],drive:'commanded-motion',terminalValues:{stage:16,settled:1,targetA:0,targetB:0,targetC:0},message:'Triad Table complete: translation and yaw compared; all three spindles home and held.'},
    'remote-pivot':{terminal:'completed',outputs:[{part:'output_beam',relativeTo:'ground_bearing',minRotationDeg:0.1},{part:'input_beam',relativeTo:'ground_bearing',minRotationDeg:0.1},{part:'follower_beam',relativeTo:'ground_bearing',observeOnly:true}],drive:'commanded-motion',terminalValues:{stage:8,arrived:0,inputReady:0,movingMask:0},message:'Complete: compare the output link with the empty remote centre. Input A holds at its saved datum.'},
    'bend-ripple':{terminal:'completed',outputs:[{part:'input_indicator',relativeTo:'A_ground_bearing',minRotationDeg:0.1},{part:'output_indicator',relativeTo:'output_bearing_60',minRotationDeg:0.1},{part:'output_bearing_60',relativeTo:'A_ground_bearing',minRotationDeg:0.1}],drive:'commanded-motion',terminalValues:{stage:8,arrived:0,inputReady:0,movingMask:0},message:'Complete: compare low and high bend ripple, then output motion while the input shaft held. Both inputs hold.'},
    'pan-shift':{terminal:'completed',outputs:[...['upper_beam','lower_beam','pan_post'].map(part=>({part,relativeTo:'frame_post_front',observeOnly:true})),{part:'A_ballast_0',relativeTo:'pan_post',minTravelM:0.001},{part:'B_ballast_0',relativeTo:'upper_beam',minTravelM:0.001}],drive:'commanded-motion',terminalValues:{stage:8,arrived:0,inputsReady:0,movingMask:0},message:'Complete: compare load positions at equal trim, then the two beam biases. Both inputs hold.'},
    samebeat: {terminal:'completed',part:'pendulum_ballast',relativeTo:'pendulum_support_axle',description:'Free pendulum swing while input is held',minTravelM:0.001,observeWhen:{stage:2,held:1},drive:'commanded-motion',terminalValues:{stage:2,held:1,targetA:0},message:'Complete. The input holds zero; the pendulum can keep swinging freely.'},
    twistspan: {terminal:'completed',part:'payload_bar',relativeTo:'upper_bar',description:'Passive beam rotation relative to held upper bar',minRotationDeg:0.1,observeWhen:{held:1},drive:'commanded-motion',terminalValues:{stage:2,held:1,targetA:0},message:'Complete. A holds zero; the passive beam is free to keep ringing down.'},
    footfall: {terminal:'done',part:'lower_triangle_h_FG',localPointLdu:[0,0,140],relativeTo:'frame_top_X_AP',referencePointLdu:[0,-20,140],description:'Authored foot G path relative to chassis P',minTravelM:0.001,drive:'commanded-motion',terminalValues:{phase:99,targetA:0},message:'Footfall cycle complete. Compare the traced path and reset before repeating.'},
    phasekeeper: {terminal:'done',part:'output_pointer',relativeTo:'output_bearing_upper',description:'Output pointer rotation relative to bearing',minRotationDeg:0.1,drive:'commanded-motion',terminalValues:{phase:99,targetA:0},message:'Phasekeeper cycle complete. Compare the blue shaft and orange pointer, then reset before repeating.'},
    vectorsum: {terminal:'done',part:'output_pointer_tip',relativeTo:'bench_rail_40_-100',description:'Authored differential output pointer point path',minTravelM:0.001,drive:'commanded-motion',terminalValues:{phase:99,targetA:0,targetB:0},message:'VectorSum cycle complete. Compare the red carrier and orange pointer, then reset before repeating.'},
    pointweaver: {terminal: 'done', part: 'endpoint_marker', relativeTo: 'base_cross_-40', description: 'Five-bar endpoint loop and return to saved pose', minTravelM: 0.001, drive: 'commanded-motion', terminalValues: {phase: 99}, message: 'PointWeaver loop complete. Compare the dashed straight edges with the endpoint path, then reset before repeating.'}
};
// Control variants deliberately preserve absent/weak passive responses as data.
Object.assign(PROGRAM_OUTPUT_CONTRACTS,{
    'phasor-twin-control':{...PROGRAM_OUTPUT_CONTRACTS['phasor-twin'],comparisonModel:'phasor-twin'},
    'poise-mass-control':{...PROGRAM_OUTPUT_CONTRACTS.poise,comparisonModel:'poise',outputs:[...PROGRAM_OUTPUT_CONTRACTS.poise.outputs,{part:'control_mass',relativeTo:'base_cross_120',observeOnly:true}]},
    'carry-ratio-control':{...PROGRAM_OUTPUT_CONTRACTS['carry-ratio'],comparisonModel:'carry-ratio',outputs:[{part:'tray_deck',relativeTo:'base_plate',minTravelM:0.001},{part:'roller_ball',relativeTo:'tray_deck',observeOnly:true},{part:'roller_ball',relativeTo:'base_plate',observeOnly:true}]},
    'pivot-exchange-wide':{...PROGRAM_OUTPUT_CONTRACTS['pivot-exchange'],comparisonModel:'pivot-exchange'},
    'evenhand-control':{...PROGRAM_OUTPUT_CONTRACTS.evenhand,comparisonModel:'evenhand'},
    'tipline-swapped':{...PROGRAM_OUTPUT_CONTRACTS.tipline,comparisonModel:'tipline'},
    'equal-share-even-springs':{...PROGRAM_OUTPUT_CONTRACTS['equal-share'],comparisonModel:'equal-share',outputs:[{part:'equalizer',relativeTo:'base_cross_left_120',minTravelM:0.001},{part:'left_rod',relativeTo:'left_cylinder',minTravelM:0.001},{part:'right_single_rod',relativeTo:'right_single_cylinder',minTravelM:0.001}]},
    'obliquity-orrery-turned-axis':{...PROGRAM_OUTPUT_CONTRACTS['obliquity-orrery'],comparisonModel:'obliquity-orrery',outputs:PROGRAM_OUTPUT_CONTRACTS['obliquity-orrery'].outputs.filter(o=>o.part!=='sun_marker'),message:'Orrery complete: compare the measured declination with sin(delta)=sin(22.5)*cos(lambda-135).'},
    'rimrun-swapped':{...PROGRAM_OUTPUT_CONTRACTS.rimrun,comparisonModel:'rimrun'},
    'swayshift-in-phase':{...PROGRAM_OUTPUT_CONTRACTS.swayshift,comparisonModel:'swayshift'},
    'samebeat-conjugate':{...PROGRAM_OUTPUT_CONTRACTS.samebeat,comparisonModel:'samebeat',outputs:[{part:'pendulum_ballast',relativeTo:'pendulum_support_axle',minTravelM:0.001},{part:'pendulum_spine_-140',relativeTo:'pendulum_support_axle',minRotationDeg:0.1},{part:'pendulum_support_axle',relativeTo:'base_floor_rail_-60',observeOnly:true}]},
    'samebeat-control':{...PROGRAM_OUTPUT_CONTRACTS.samebeat,comparisonModel:'samebeat',outputs:[{part:'pendulum_ballast',relativeTo:'pendulum_support_axle',minRotationDeg:0.1},{part:'pendulum_spine_-140',relativeTo:'pendulum_support_axle',minRotationDeg:0.1},{part:'pendulum_support_axle',relativeTo:'base_floor_rail_-60',observeOnly:true}]},
    'twistspan-inner':{...PROGRAM_OUTPUT_CONTRACTS.twistspan,comparisonModel:'twistspan',outputs:[{part:'payload_bar',relativeTo:'upper_bar',minRotationDeg:0.1},{part:'payload_bar',relativeTo:'base_frame_left',observeOnly:true}]},
    'high-select-mirror':{...PROGRAM_OUTPUT_CONTRACTS['high-select'],comparisonModel:'high-select'},
    'foldback-open':{...PROGRAM_OUTPUT_CONTRACTS.foldback,comparisonModel:'foldback'},
    'thirdline-control':{...PROGRAM_OUTPUT_CONTRACTS.thirdline,comparisonModel:'thirdline'},
    'impulse-line-missing-middle':{...PROGRAM_OUTPUT_CONTRACTS['impulse-line'],comparisonModel:'impulse-line',outputs:[{part:'pendulum_left_bob_key',relativeTo:'bridge_rail',minTravelM:0.001},{part:'pendulum_right_bob_key',relativeTo:'bridge_rail',observeOnly:true}]},
    'travel-dial-wheel-raised':{...PROGRAM_OUTPUT_CONTRACTS['travel-dial'],comparisonModel:'travel-dial',outputs:[{part:'sled_deck',relativeTo:'guide_-60_axle',minTravelM:0.001},{part:'wheel',relativeTo:'guide_-60_axle',observeOnly:true}]},
    'ghost-pivot-unequal-link':{...PROGRAM_OUTPUT_CONTRACTS['ghost-pivot'],comparisonModel:'ghost-pivot'},
    'afterturn-fixed-masses':{...PROGRAM_OUTPUT_CONTRACTS.afterturn,comparisonModel:'afterturn',outputs:[{part:'yaw_top',relativeTo:'yaw_bottom',observeOnly:true},...['slider_left_plate_0','slider_right_plate_0'].map(part=>({part,relativeTo:'yaw_top',observeOnly:true}))]},
    'quiet-partner-control':{...PROGRAM_OUTPUT_CONTRACTS['quiet-partner'],comparisonModel:'quiet-partner',outputs:[{part:'primary_axle',relativeTo:'lower_rail_neg',minRotationDeg:0.1},{part:'absorber_axle',relativeTo:'lower_rail_neg',observeOnly:true}]},
    'air-budget-two-tanks':{...PROGRAM_OUTPUT_CONTRACTS['air-budget'],comparisonModel:'air-budget'}
});
// Ask the product API for the authored measurement point. A nearby marker tip can
// rotate about that point, so its path cannot substitute for the named origin.
const conjugate=q=>[-q[0],-q[1],-q[2],q[3]];
const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
export const rotatePoint=(q,p)=>multiply(multiply(q,[...p,0]),conjugate(q)).slice(0,3);
export function orientationTravelDeg(a,b) {
    const denominator=Math.hypot(...a)*Math.hypot(...b);
    if(!denominator)return NaN;
    const cosine=Math.min(1,Math.abs(a.reduce((v,x,i)=>v+x*b[i],0))/denominator);
    return cosine>1-1e-15?0:2*Math.acos(cosine)*180/Math.PI;
}
export function readOutputPose(api, contract, placements) {
    const reading=api?.pose(contract.part), reference=contract.relativeTo ? api?.pose(contract.relativeTo) : null;
    const valid=r=>r?.ok && Array.isArray(r.position) && r.position.length===3 && r.position.every(Number.isFinite) && Array.isArray(r.quat) && r.quat.length===4 && r.quat.every(Number.isFinite) && Math.hypot(...r.quat)>0;
    if(!valid(reading) || (contract.relativeTo && !valid(reference))) return null;
    const point=(pose,id,local)=>{
        if(!local)return pose.position;
        const placement=placements?.get(id),m=placement?.rotation;
        if(!m||m.length!==9)return null;
        // Authored part-local LDraw point -> saved world displacement -> current
        // body rotation. pose() already supplies the current part origin.
        const ldu=[0,1,2].map(i=>m[i*3]*local[0]+m[i*3+1]*local[1]+m[i*3+2]*local[2]);
        const offset=rotatePoint(pose.quat,[ldu[0]*0.0004,-ldu[1]*0.0004,-ldu[2]*0.0004]);
        return pose.position.map((v,i)=>v+offset[i]);
    };
    const position=point(reading,contract.part,contract.localPointLdu),origin=reference?point(reference,contract.relativeTo,contract.referencePointLdu):[0,0,0];
    if(!position||!origin)return null;
    // Reference-frame coordinates remove translation AND reference rotation.
    const delta=position.map((v,i)=>v-origin[i]);
    return {...reading,position:reference?rotatePoint(conjugate(reference.quat),delta):delta,quat:reference?multiply(conjugate(reference.quat),reading.quat):reading.quat.slice()};
}
export function observeTerminal(state, variables, name) {
    if (!name) return;
    if (Number(variables[name]) === 0) state.sawZero = true;
    if (state.sawZero && Number(variables[name]) === 1) state.sawTransition = true;
}
export function programCompletion(report, contract) {
    const gaps = [];
    if (!contract) gaps.push('OUTPUT_CONTRACT_UNREVIEWED');
    if (report.execution !== 'COMPLETED') gaps.push('PROGRAM_DID_NOT_EXIT');
    let terminalVerified=false;
    if(contract?.terminalMode){
        terminalVerified=report.execution==='COMPLETED'&&report.programKind==='SUPPLIED';
        for(const [opcode,count] of Object.entries(contract.requiredOpcodes||{}))if(report.executedOpcodes?.[opcode]!==count)terminalVerified=false;
        if(contract.forbiddenOpcodes?.some(opcode=>report.executedOpcodes?.[opcode]))terminalVerified=false;
        if(contract.message&&!report.messages?.includes(contract.message))terminalVerified=false;
        if(!terminalVerified)gaps.push('DOCUMENTED_TERMINAL_PATH_NOT_REACHED');
    }else if(contract){terminalVerified=report.terminalObservation?.sawTransition&&Number(report.programVariables?.[contract.terminal])===1;if(!terminalVerified)gaps.push('TERMINAL_FLAG_NOT_REACHED');}
    if (contract?.drive === 'commanded-motion' && !Object.values(report.motors || {}).some(m => m.commanded && m.moved)) gaps.push('PRIMARY_DRIVE_MOVEMENT_UNVERIFIED');
    const contracts=contract?.outputs||[contract],outputs=report.outputMeasurements||[report.outputMeasurement];
    if(contract)for(let i=0;i<contracts.length;i++){
        const rule=contracts[i],output=outputs[i];
        if(!output||output.samples<2||output.invalid||(rule.minTravelM!==undefined&&(!Number.isFinite(output.travelM)||output.travelM<rule.minTravelM))||(rule.minRotationDeg!==undefined&&(!Number.isFinite(output.rotationDeg)||output.rotationDeg<rule.minRotationDeg))||(rule.minRangeM!==undefined&&(!Number.isFinite(output.rangeM)||output.rangeM<rule.minRangeM))||(rule.requireRise&&(!output.networks||!Object.values(output.networks).some(n=>n.maxKpa>n.initialKpa))))gaps.push('MEANINGFUL_OUTPUT_NOT_OBSERVED:'+i);
    }
    if (contract?.outputReviewPending) gaps.push('OUTPUT_GEOMETRY_REVIEW_PENDING');
    for (const [name, value] of Object.entries(contract?.terminalValues || {})) if (typeof value==='string'?String(report.programVariables?.[name])!==value:Number(report.programVariables?.[name])!==value) gaps.push('TERMINAL_STAGE_NOT_REACHED:' + name);
    if (contract?.message && !report.messages?.includes(contract.message)) gaps.push('TERMINAL_MESSAGE_UNVERIFIED');
    const faults = [...(report.failures || [])];
    return {status: faults.length ? 'FAIL' : gaps.length ? 'PARTIAL' : 'COMPLETE', gaps, failures: faults,terminalVerified:Boolean(terminalVerified)};
}

export const outputRules=contract=>contract?.outputs||[contract];
export function createOutputMeasurement(rule){return {part:rule?.part||null,type:rule?.type||'pose',samples:0,invalid:false,travelM:0,homeErrorM:null,rotationDeg:0,initialQuat:null,initial:null,final:null,...(rule?.type==='air-pressure'?{networks:{}}:{})};}
export function observeOutput(output,rule,{api,core,placements}){
    if(['axis-projection','radial-distance'].includes(rule.type)){
        const point=readOutputPose(api,{part:rule.part},placements),origin=readOutputPose(api,{part:rule.axisPart},placements),endpoint=readOutputPose(api,{part:rule.axisPart,localPointLdu:rule.axisLocalLdu},placements);
        if(!point||!origin||!endpoint){output.invalid=true;return null;}
        const axis=endpoint.position.map((v,i)=>v-origin.position[i]),length=Math.hypot(...axis);
        if(!Number.isFinite(length)||!length){output.invalid=true;return null;}
        const unit=axis.map(v=>v/length),delta=point.position.map((v,i)=>v-origin.position[i]),projection=delta.reduce((v,x,i)=>v+x*unit[i],0),valueM=rule.type==='axis-projection'?projection:Math.hypot(...delta.map((v,i)=>v-projection*unit[i]));
        output.samples++;output.initialM??=valueM;output.minM=Math.min(output.minM??valueM,valueM);output.maxM=Math.max(output.maxM??valueM,valueM);output.finalM=valueM;output.rangeM=output.maxM-output.minM;
        return {valueM,point:point.position,axisOrigin:origin.position,axisEnd:endpoint.position};
    }
    if(rule.type==='distance'){
        const readings=rule.parts.map(part=>readOutputPose(api,{part},placements));
        if(readings.some(r=>!r)){output.invalid=true;return null;}
        const distanceM=Math.hypot(...readings[0].position.map((v,i)=>v-readings[1].position[i]));
        output.samples++;output.initialM ??= distanceM;output.minM=Math.min(output.minM??distanceM,distanceM);output.maxM=Math.max(output.maxM??distanceM,distanceM);output.finalM=distanceM;output.rangeM=output.maxM-output.minM;
        return {parts:rule.parts,distanceM,positions:readings.map(r=>r.position)};
    }
    if(rule.type==='air-pressure'){
        const networks=core.airState();
        if(!Array.isArray(networks)||!networks.length||networks.some(n=>!Number.isFinite(n.kPa))){output.invalid=true;return null;}
        for(const n of networks){const prior=output.networks[n.id]||{initialKpa:n.kPa,minKpa:n.kPa,maxKpa:n.kPa};prior.minKpa=Math.min(prior.minKpa,n.kPa);prior.maxKpa=Math.max(prior.maxKpa,n.kPa);prior.finalKpa=n.kPa;output.networks[n.id]=prior;}output.samples++;return {networks};
    }
    const reading=readOutputPose(api,rule,placements);
    if(!reading){output.invalid=true;return null;}
    output.samples++;output.initial ||= reading.position.slice();output.initialQuat ||= reading.quat.slice();output.rotationDeg=Math.max(output.rotationDeg,orientationTravelDeg(output.initialQuat,reading.quat));output.final=reading.position.slice();output.homeErrorM=Math.hypot(...reading.position.map((v,i)=>v-output.initial[i]));output.travelM=Math.max(output.travelM,output.homeErrorM);return reading;
}
