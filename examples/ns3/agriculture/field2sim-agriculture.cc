#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "ns3/wifi-module.h"
#include <fstream>
#include <iostream>
#include <iomanip>
#include <map>
#include <set>
#include <sstream>
#include <cstring>
using namespace ns3;
static NodeContainer nodes;
static unsigned sent=0,received=0,checks=0,failures=0;
static unsigned perNode[120]{};
static std::map<uint64_t,double> signals;
static std::set<std::pair<unsigned,unsigned>> delivered;
static std::ofstream txlog,rxlog,poslog;
static bool mobile=true;
static Vector initial;
struct Data {uint32_t magic,node,seq;double generated;};
static void Signal(Ptr<const Packet> p,uint16_t,WifiTxVector,MpduInfo,SignalNoiseDbm sn,uint16_t){signals[p->GetUid()]=sn.signal;}
static void Consume(Ptr<const Packet> p){
 Data d{};if(p->GetSize()!=128)return;p->CopyData(reinterpret_cast<uint8_t*>(&d),sizeof d);
 if(d.magic!=0xF251A001||d.node>=120)return;
 if(!delivered.insert({d.node,d.seq}).second)return;
 auto it=signals.find(p->GetUid());if(it==signals.end()){failures++;return;}
 auto v=nodes.Get(120)->GetObject<MobilityModel>()->GetPosition();
 received++;perNode[d.node]++;
 rxlog<<d.node+1<<','<<d.seq<<','<<Simulator::Now().GetSeconds()<<','<<it->second<<','<<v.x<<','<<v.y<<','<<v.z<<'\n';signals.erase(it);
}
static bool Receive(Ptr<NetDevice>,Ptr<const Packet> p,uint16_t,const Address&){Simulator::ScheduleNow(&Consume,p);return true;}
static void Send(Ptr<NetDevice> dev,unsigned node,unsigned seq){
 uint8_t payload[128]{};Data d{0xF251A001,node,seq,Simulator::Now().GetSeconds()};std::memcpy(payload,&d,sizeof d);
 sent++;txlog<<node+1<<','<<seq<<','<<d.generated<<'\n';
 dev->Send(Create<Packet>(payload,sizeof payload),Mac48Address::GetBroadcast(),0x88b5);
}
static void Check(unsigned id,Vector expected){
 if(id==120&&!mobile)expected=initial;
 auto actual=nodes.Get(id)->GetObject<MobilityModel>()->GetPosition();double e=CalculateDistance(actual,expected);checks++;if(e>1e-5)failures++;
 poslog<<Simulator::Now().GetSeconds()<<','<<id+1<<','<<actual.x<<','<<actual.y<<','<<actual.z<<','<<e<<'\n';
}
int main(int argc,char**argv){
 std::string trace="mobility.tcl",checkpoint="checkpoints.csv",prefix="mobile";double stop=677.458;unsigned run=1;bool enableTx=true;
 CommandLine cmd;cmd.AddValue("trace","Field2Sim trace",trace);cmd.AddValue("checkpoints","Position expectations",checkpoint);cmd.AddValue("prefix","Output prefix",prefix);cmd.AddValue("stop","Stop seconds",stop);cmd.AddValue("mobile","Follow route",mobile);cmd.AddValue("run","RNG run",run);cmd.AddValue("enableTx","Enable sensor packets",enableTx);cmd.Parse(argc,argv);
 RngSeedManager::SetSeed(123456);RngSeedManager::SetRun(run);nodes.Create(121);
 Ns2MobilityHelper movement(trace);movement.Install();initial=nodes.Get(120)->GetObject<MobilityModel>()->GetPosition();
 // Stationary control loads a trace containing the same initial state but no setdest commands.
 txlog.open(prefix+"-tx.csv");rxlog.open(prefix+"-rx.csv");poslog.open(prefix+"-positions.csv");
 if(!txlog||!rxlog||!poslog)return 2;
 txlog<<std::setprecision(12)<<"node,seq,time_s\n";rxlog<<std::setprecision(12)<<"node,seq,time_s,rssi_dbm,uav_x,uav_y,uav_z\n";poslog<<std::setprecision(12)<<"time_s,node,x,y,z,error_m\n";
 YansWifiChannelHelper channel;channel.SetPropagationDelay("ns3::ConstantSpeedPropagationDelayModel");channel.AddPropagationLoss("ns3::LogDistancePropagationLossModel","Exponent",DoubleValue(2.7),"ReferenceDistance",DoubleValue(1),"ReferenceLoss",DoubleValue(40.045997));
 YansWifiPhyHelper phy;phy.SetChannel(channel.Create());phy.Set("TxPowerStart",DoubleValue(0));phy.Set("TxPowerEnd",DoubleValue(0));phy.Set("RxSensitivity",DoubleValue(-85));phy.Set("ChannelSettings",StringValue("{1, 20, BAND_2_4GHZ, 0}"));
 WifiHelper wifi;wifi.SetStandard(WIFI_STANDARD_80211g);wifi.SetRemoteStationManager("ns3::ConstantRateWifiManager","DataMode",StringValue("ErpOfdmRate6Mbps"),"ControlMode",StringValue("ErpOfdmRate6Mbps"));
 WifiMacHelper mac;mac.SetType("ns3::AdhocWifiMac");auto devices=wifi.Install(phy,mac,nodes);wifi.AssignStreams(devices,10);
 devices.Get(120)->SetReceiveCallback(MakeCallback(&Receive));DynamicCast<WifiNetDevice>(devices.Get(120))->GetPhy()->TraceConnectWithoutContext("MonitorSnifferRx",MakeCallback(&Signal));
 if(enableTx)for(unsigned i=0;i<120;i++){unsigned seq=0;for(double t=5+2.0*i/120;t<stop-2;t+=2)Simulator::Schedule(Seconds(t),&Send,devices.Get(i),i,seq++);}
 std::ifstream in(checkpoint);if(!in)return 2;std::string line;
 while(std::getline(in,line)){for(char&c:line)if(c==',')c=' ';std::istringstream row(line);double t,x,y,z;unsigned id;if(!(row>>t>>id>>x>>y>>z))return 2;Simulator::Schedule(Seconds(t),&Check,id,Vector(x,y,z));}
 Simulator::Stop(Seconds(stop));Simulator::Run();
 unsigned covered=0;for(auto n:perNode)if(n)covered++;
 std::cout<<"SUMMARY sent="<<sent<<" received="<<received<<" sensors_reached="<<covered<<" sensors=120 position_checks="<<checks<<" failures="<<failures<<" mobile="<<mobile<<std::endl;
 Simulator::Destroy();return failures?1:0;
}
