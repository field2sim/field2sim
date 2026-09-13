load [file join [file dirname [info script]] libField2SimWcl.so] Field2SimWcl
set ns [new Simulator]
set tracefd [open [file join [file dirname [info script]] packets.tr] w]
$ns trace-all $tracefd
ns-random 123456
set topo [new Topography]
$topo load_flatgrid 200 200
create-god 4
Phy/WirelessPhy set Pt_ 0.001
Phy/WirelessPhy set freq_ 2.4e9
Phy/WirelessPhy set RXThresh_ 3.16227766e-12
Phy/WirelessPhy set CSThresh_ 1.0e-12
Antenna/OmniAntenna set Z_ 1.5
$ns node-config -adhocRouting DSDV -llType LL -macType Mac/802_11 -ifqType Queue/DropTail/PriQueue -ifqLen 50 -antType Antenna/OmniAntenna -propType Propagation/FreeSpace -phyType Phy/WirelessPhy -channelType Channel/WirelessChannel -topoInstance $topo -agentTrace OFF -routerTrace OFF -macTrace OFF
set coords {{10 10} {35 35} {65 35} {50 65}}
for {set i 0} {$i<4} {incr i} {
 set node($i) [$ns node]
 $node($i) random-motion 0
 $node($i) set X_ [lindex $coords $i 0]
 $node($i) set Y_ [lindex $coords $i 1]
 $node($i) set Z_ 0
 set agent($i) [new Agent/Field2SimWcl]
 $node($i) attach $agent($i) 42
 $agent($i) attach-node $node($i) $i
}
set sites {{10 10} {50 10} {90 10} {90 50} {90 90} {50 90} {10 90} {10 50}}
for {set i 0} {$i<8} {incr i} {
 $ns at [expr {5+4*$i}] "$node(0) set X_ [lindex $sites $i 0]; $node(0) set Y_ [lindex $sites $i 1]"
}
for {set seq 0} {$seq<16} {incr seq} {
 $ns at [expr {6+4*($seq/2)+($seq%2)}] "$agent(0) beacon $seq"
}
proc results {} {
 global agent node ns
 set count 0
 set sum 0
 for {set i 1} {$i<4} {incr i} {
  set est [$agent($i) estimate]
  if {$est=="unlocalized"} {puts "UNLOCALIZED node=$i";continue}
  set ex [lindex $est 0];set ey [lindex $est 1]
  set tx [$node($i) set X_];set ty [$node($i) set Y_]
  set error [expr {hypot($ex-$tx,$ey-$ty)}]
  puts "ERROR node=$i true_x=$tx true_y=$ty error_m=$error"
  incr count;set sum [expr {$sum+$error}]
 }
 set mean [expr {$count>0 ? $sum/$count : -1}]
 puts "SUMMARY localized=$count unknowns=3 mean_error_m=$mean status=[expr {$count==3?"PASS":"FAIL"}]"
 exit [expr {$count==3?0:1}]
}
$ns at 38 results
$ns run
