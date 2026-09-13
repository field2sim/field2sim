#include <omnetpp.h>
#include "inet/common/packet/Packet.h"
#include "inet/common/packet/chunk/BytesChunk.h"
#include "inet/common/ProtocolTag_m.h"
#include "inet/common/Protocol.h"
#include "inet/mobility/contract/IMobility.h"
#include "inet/physicallayer/wireless/common/contract/packetlevel/SignalTag_m.h"
#include "wcl.h"
#include "inet/physicallayer/wireless/common/contract/packetlevel/IRadio.h"
#include <cstring>
#include <iostream>
#include <iomanip>
using namespace omnetpp;
using namespace inet;
class WclApp:public cSimpleModule {
 Wcl state{};int id;unsigned received=0;
 public:
 int estimate(double*x,double*y)const{return wcl_estimate(&state,x,y);}
 unsigned receptions()const{return received;}
 protected:
 int numInitStages() const override { return NUM_INIT_STAGES; }
 void initialize(int stage)override{
  // Enable listening only after RadioMedium has registered every radio.
  if(stage == INITSTAGE_LAST) { check_and_cast<physicallayer::IRadio*>(getParentModule()->getSubmodule("radio"))->setRadioMode(physicallayer::IRadio::RADIO_MODE_TRANSCEIVER); }
  if(stage != INITSTAGE_LOCAL) return;
  id=getParentModule()->getIndex();
  if(id==0)for(int seq=0;seq<16;seq++)scheduleAt(6+4*(seq/2)+(seq%2),new cMessage("beacon",seq));
 }
 void handleMessage(cMessage*m)override{
  if(m->isSelfMessage()){
   unsigned seq=m->getKind();
   auto mobility=check_and_cast<IMobility*>(getParentModule()->getSubmodule("mobility"));
   const auto pos=mobility->getCurrentPosition();
   Beacon b{0xF251,(uint16_t)seq,(uint16_t)(seq/2),(int16_t)std::lround(pos.x*100),(int16_t)std::lround(pos.y*100)};
   auto packet=new Packet("anchor-beacon");auto bytes=makeShared<BytesChunk>();
   bytes->setBytes(std::vector<uint8_t>((uint8_t*)&b,(uint8_t*)&b+sizeof b));packet->insertAtBack(bytes);
   packet->addTag<PacketProtocolTag>()->setProtocol(&Protocol::udp);
   std::cout<<"TX seq="<<seq<<" site="<<seq/2<<" x="<<pos.x<<" y="<<pos.y<<std::endl;
   send(packet,"out");delete m;return;
  }
  auto packet=check_and_cast<Packet*>(m);
  if(id>0){
   const auto bytes=packet->peekAtFront<BytesChunk>()->getBytes();Beacon b{};
   if(bytes.size()!=sizeof b)throw cRuntimeError("Invalid beacon length");memcpy(&b,bytes.data(),sizeof b);
   auto power=packet->findTag<SignalPowerInd>();
   if(!power || !(power->getPower().get()>0))throw cRuntimeError("Missing receiver signal power");
   double rssi=10*log10(power->getPower().get()*1000);
   if(wcl_add(&state,&b,rssi)){received++;std::cout<<"RX node="<<id<<" seq="<<b.seq<<" site="<<b.site<<" ax="<<b.x_cm/100.0<<" ay="<<b.y_cm/100.0<<" rssi_dbm="<<rssi<<std::endl;}
  }
  delete packet;
 }
};
Define_Module(WclApp);
class WclEvaluator:public cSimpleModule {
 protected:
 void initialize()override{std::cout<<std::fixed<<std::setprecision(6);scheduleAt(38,new cMessage("evaluate"));}
 void handleMessage(cMessage*m)override{
  delete m;double sum=0;unsigned localized=0;
  for(int i=1;i<4;i++){
   auto host=getParentModule()->getSubmodule("host",i);auto app=check_and_cast<WclApp*>(host->getSubmodule("app"));double x,y;int n=app->estimate(&x,&y);
   if(!n){std::cout<<"UNLOCALIZED node="<<i<<std::endl;continue;}
   std::cout<<"EST node="<<i<<" sites="<<n<<" received="<<app->receptions()<<" x="<<x<<" y="<<y<<std::endl;
   auto truth=check_and_cast<IMobility*>(host->getSubmodule("mobility"))->getCurrentPosition();double error=std::hypot(x-truth.x,y-truth.y);sum+=error;localized++;
   std::cout<<"ERROR node="<<i<<" true_x="<<truth.x<<" true_y="<<truth.y<<" error_m="<<error<<std::endl;
  }
  std::cout<<"SUMMARY localized="<<localized<<" unknowns=3 mean_error_m="<<(localized?sum/localized:-1)<<" status="<<(localized==3?"PASS":"FAIL")<<std::endl;
  if(localized!=3)throw cRuntimeError("Not all unknown nodes localized");endSimulation();
 }
};
Define_Module(WclEvaluator);
