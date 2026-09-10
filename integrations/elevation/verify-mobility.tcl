# Parser-execution verifier for Field2Sim's ns-2 adapter, run against a
# real /usr/bin/ns (CMU wireless MobileNode model). It does not re-parse the
# Tcl trace itself: it sources the adapter artifact exactly as any ns-2 user
# script would, then reads back MobileNode's own X_/Y_/Z_ state.
#
# ns-2's Topography/God bookkeeping rejects negative coordinates, so the
# caller (tests/run-ns2-integration.js) sources an OFFSET-shifted copy of the
# real committed fixture rather than the fixture itself; OFFSET is undone
# below before comparison. The shift is a grid-bounds workaround only -- it
# does not change the mobility grammar under test.
#
# MobileNode::X_/Y_/Z_ are lazily updated: the CMU model only recomputes them
# (MobileNode::update_position(), linear interpolation from speed_/dX_/dY_)
# when something triggers it. The "log-movement" command does exactly that
# before writing to log_target_; log_target_ is never set here, so the write
# is a safe no-op and log-movement becomes a pure position-refresh call.
#
# Usage: ns verify-mobility.tcl <offsetTraceFile> <scenario:mobile|static> <offset> <tolerance>

set traceFile   [lindex $argv 0]
set scenario    [lindex $argv 1]
set OFFSET      [lindex $argv 2]
set TOLERANCE   [lindex $argv 3]
set FAILCOUNT 0

proc check {label t nodeId expX expY expZ} {
    global node_ OFFSET TOLERANCE FAILCOUNT
    $node_($nodeId) log-movement
    set x [expr {[$node_($nodeId) set X_] - $OFFSET}]
    set y [expr {[$node_($nodeId) set Y_] - $OFFSET}]
    set z [$node_($nodeId) set Z_]
    set err [expr {sqrt(($x-$expX)*($x-$expX) + ($y-$expY)*($y-$expY) + ($z-$expZ)*($z-$expZ))}]
    set status [expr {$err <= $TOLERANCE ? "PASS" : "FAIL"}]
    if {$status == "FAIL"} { incr FAILCOUNT }
    puts [format "NS2_CHECK label=%s node=%d time_s=%.3f expected_x=%.9f expected_y=%.9f expected_z=%.9f actual_x=%.9f actual_y=%.9f actual_z=%.9f error_m=%.9f status=%s" \
        $label $nodeId $t $expX $expY $expZ $x $y $z $err $status]
}

if {$scenario == "mobile"} {
    set nodeCount 1
    set checkpoints {
        {initial            0.0  0    0.0            0.0    33}
        {segment-1-quarter  0.5  0    0.75          -1.0    33}
        {segment-1-midpoint 1.0  0    1.5           -2.0    33}
        {segment-2-early    2.5  0    2.1666666665  -4.0    34}
        {segment-2-midpoint 3.5  0    0.5           -4.0    34}
        {segment-3-early    5.5  0   -2.0           -2.75   29}
        {segment-3-midpoint 7.0  0   -2.0            1.0    29}
        {terminal-hold      9.1  0   -2.0            6.0    31}
    }
    set stopTime 9.2
} else {
    set nodeCount 3
    set checkpoints {
        {static-node-0 0.1 0  0.0    0.0     33}
        {static-node-1 0.1 1  12.5  -8.0     34}
        {static-node-2 0.1 2  -4.0  -15.25   29}
    }
    set stopTime 0.2
}

set opt(x) 100000
set opt(y) 100000

set ns_ [new Simulator]
set tracefd [open [format "%s.tr" $traceFile] w]
$ns_ trace-all $tracefd
set wtopo [new Topography]
$wtopo load_flatgrid $opt(x) $opt(y)
set god_ [create-god $nodeCount]

$ns_ node-config -adhocRouting DSDV \
                 -llType LL \
                 -macType Mac/802_11 \
                 -ifqType Queue/DropTail/PriQueue \
                 -ifqLen 50 \
                 -antType Antenna/OmniAntenna \
                 -propType Propagation/TwoRayGround \
                 -phyType Phy/WirelessPhy \
                 -channelType Channel/WirelessChannel \
                 -topoInstance $wtopo \
                 -agentTrace OFF \
                 -routerTrace OFF \
                 -macTrace OFF

for {set i 0} {$i < $nodeCount} {incr i} {
    set node_($i) [$ns_ node]
    $node_($i) random-motion 0
}

source $traceFile

foreach cp $checkpoints {
    set label [lindex $cp 0]
    set t     [lindex $cp 1]
    set nid   [lindex $cp 2]
    set ex    [lindex $cp 3]
    set ey    [lindex $cp 4]
    set ez    [lindex $cp 5]
    $ns_ at $t "check $label $t $nid $ex $ey $ez"
}
$ns_ at $stopTime "$ns_ halt"
$ns_ run

puts [format "NS2_RESULT scenario=%s checks=%d status=%s" $scenario [llength $checkpoints] [expr {$FAILCOUNT == 0 ? "PASS" : "FAIL"}]]
