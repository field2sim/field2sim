#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "ns3/wifi-module.h"
#include "wcl.h"
#include <map>
#include <iostream>
#include <iomanip>
using namespace ns3;
static Wcl estimates[4]{};
static std::map<std::pair<unsigned,uint64_t>,double> signals;
static NodeContainer nodes;
static const double site[8][2]={{10,10},{50,10},{90,10},{90,50},{90,90},{50,90},{10,90},{10,50}};
static unsigned received[4]{};
static bool success=true;
static void Signal(unsigned node,Ptr<const Packet> p,uint16_t,WifiTxVector,MpduInfo,SignalNoiseDbm sn,uint16_t){ signals[{node,p->GetUid()}]=sn.signal; }
static void Consume(unsigned node,Ptr<const Packet> p){
 Beacon b{};if(p->GetSize()!=sizeof b)return;p->CopyData((uint8_t*)&b,sizeof b);
 auto it=signals.find({node,p->GetUid()});
 if(it==signals.end()){std::cerr<<"MISSING_RSSI node="<<node<<" uid="<<p->GetUid()<<std::endl;success=false;return;}
 if(wcl_add(&estimates[node],&b,it->second)){
  received[node]++;
  std::cout<<"RX node="<<node<<" seq="<<b.seq<<" site="<<b.site<<" ax="<<b.x_cm/100.0<<" ay="<<b.y_cm/100.0<<" rssi_dbm="<<it->second<<std::endl;
 }
}
static bool Receive(unsigned node,Ptr<NetDevice>,Ptr<const Packet> p,uint16_t,const Address&){ if(node)Simulator::ScheduleNow(&Consume,node,p);return true; }
static void Transmit(Ptr<NetDevice> dev,unsigned seq){
 unsigned i=seq/2;auto pos=nodes.Get(0)->GetObject<MobilityModel>()->GetPosition();
 Beacon b{0xF251,(uint16_t)seq,(uint16_t)i,(int16_t)std::lround(pos.x*100),(int16_t)std::lround(pos.y*100)};
 std::cout<<"TX seq="<<seq<<" site="<<i<<" x="<<pos.x<<" y="<<pos.y<<std::endl;
 dev->Send(Create<Packet>((uint8_t*)&b,sizeof b),Mac48Address::GetBroadcast(),0x88b5);
}
static void Results(){
 double sum=0;unsigned localized=0;
 for(unsigned i=1;i<4;i++){
  double x,y;int n=wcl_estimate(&estimates[i],&x,&y);
  if(!n){std::cout<<"UNLOCALIZED node="<<i<<" received="<<received[i]<<std::endl;success=false;continue;}
  std::cout<<"EST node="<<i<<" sites="<<n<<" received="<<received[i]<<" x="<<x<<" y="<<y<<std::endl;
  /* Ground truth is accessed only by this simulator-side evaluation. */
  auto truth=nodes.Get(i)->GetObject<MobilityModel>()->GetPosition();
  double e=std::hypot(x-truth.x,y-truth.y);sum+=e;localized++;
  std::cout<<"ERROR node="<<i<<" true_x="<<truth.x<<" true_y="<<truth.y<<" error_m="<<e<<std::endl;
 }
 std::cout<<"SUMMARY localized="<<localized<<" unknowns=3 mean_error_m="<<(localized?sum/localized:-1)<<" status="<<(success?"PASS":"FAIL")<<std::endl;
}
int main(int argc,char**argv){
 CommandLine cmd;cmd.Parse(argc,argv);RngSeedManager::SetSeed(123456);RngSeedManager::SetRun(1);
 std::cout<<std::fixed<<std::setprecision(6);nodes.Create(4);
 MobilityHelper mob;mob.SetMobilityModel("ns3::ConstantPositionMobilityModel");mob.Install(nodes);
 const double initial[4][2]={{10,10},{35,35},{65,35},{50,65}};
 for(unsigned i=0;i<4;i++)nodes.Get(i)->GetObject<MobilityModel>()->SetPosition(Vector(initial[i][0],initial[i][1],0));
 for(unsigned i=0;i<8;i++)Simulator::Schedule(Seconds(5+4*i),&MobilityModel::SetPosition,nodes.Get(0)->GetObject<MobilityModel>(),Vector(site[i][0],site[i][1],0));
 YansWifiChannelHelper channel;channel.SetPropagationDelay("ns3::ConstantSpeedPropagationDelayModel");channel.AddPropagationLoss("ns3::LogDistancePropagationLossModel","Exponent",DoubleValue(2),"ReferenceLoss",DoubleValue(40));
 YansWifiPhyHelper phy;phy.SetChannel(channel.Create());phy.Set("TxPowerStart",DoubleValue(0));phy.Set("TxPowerEnd",DoubleValue(0));phy.Set("RxSensitivity",DoubleValue(-85));phy.Set("ChannelSettings",StringValue("{1, 20, BAND_2_4GHZ, 0}"));
 WifiHelper wifi;wifi.SetStandard(WIFI_STANDARD_80211g);wifi.SetRemoteStationManager("ns3::ConstantRateWifiManager","DataMode",StringValue("ErpOfdmRate6Mbps"),"ControlMode",StringValue("ErpOfdmRate6Mbps"));
 WifiMacHelper mac;mac.SetType("ns3::AdhocWifiMac");auto devices=wifi.Install(phy,mac,nodes);
 for(unsigned i=0;i<4;i++){
  devices.Get(i)->SetReceiveCallback(MakeBoundCallback(&Receive,i));
  DynamicCast<WifiNetDevice>(devices.Get(i))->GetPhy()->TraceConnectWithoutContext("MonitorSnifferRx",MakeBoundCallback(&Signal,i));
 }
 for(unsigned seq=0;seq<16;seq++)Simulator::Schedule(Seconds(6+4*(seq/2)+(seq%2)),&Transmit,devices.Get(0),seq);
 Simulator::Schedule(Seconds(38),&Results);Simulator::Stop(Seconds(39));Simulator::Run();Simulator::Destroy();return success?0:1;
}
