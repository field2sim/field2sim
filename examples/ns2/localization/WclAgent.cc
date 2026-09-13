#include <agent.h>
#include <packet.h>
#include <ip.h>
#include <mobilenode.h>
#include <cstring>
#include <cstdio>
#include "wcl.h"
class WclAgent:public Agent {
 Wcl state{};MobileNode *node=nullptr;int id=0;unsigned received=0;
 public:
 WclAgent():Agent(PT_UDP){}
 int command(int argc,const char*const*argv) override {
  if(argc==4 && !strcmp(argv[1],"attach-node")){node=dynamic_cast<MobileNode*>(TclObject::lookup(argv[2]));id=atoi(argv[3]);return node?TCL_OK:TCL_ERROR;}
  if(argc==3 && !strcmp(argv[1],"beacon")){
   if(!node || id!=0)return TCL_ERROR;
   int seq=atoi(argv[2]);node->update_position();
   Beacon b{0xF251,(uint16_t)seq,(uint16_t)(seq/2),(int16_t)lround(node->X()*100),(int16_t)lround(node->Y()*100)};
   Packet*p=allocpkt();p->allocdata(sizeof b);memcpy(p->accessdata(),&b,sizeof b);
   hdr_cmn::access(p)->size()=sizeof b+28;
   hdr_ip::access(p)->daddr()=IP_BROADCAST;hdr_ip::access(p)->dport()=42;hdr_ip::access(p)->ttl()=1;
   printf("TX seq=%d site=%d x=%.3f y=%.3f\n",seq,seq/2,node->X(),node->Y());target_->recv(p);return TCL_OK;
  }
  if(argc==2 && !strcmp(argv[1],"estimate")){
   double x,y;int n=wcl_estimate(&state,&x,&y);
   if(!n){Tcl::instance().result("unlocalized");return TCL_OK;}
   printf("EST node=%d sites=%d received=%u x=%.6f y=%.6f\n",id,n,received,x,y);
   Tcl::instance().resultf("%.12f %.12f",x,y);return TCL_OK;
  }
  return Agent::command(argc,argv);
 }
 void recv(Packet*p,Handler*) override {
  if(id>0 && p->datalen()==sizeof(Beacon)){
   Beacon b;memcpy(&b,p->accessdata(),sizeof b);
   double power=p->txinfo_.RxPr;
   if(power>0 && wcl_add(&state,&b,10*log10(power*1000))){received++;printf("RX node=%d seq=%u site=%u ax=%.3f ay=%.3f rssi_dbm=%.6f\n",id,b.seq,b.site,b.x_cm/100.0,b.y_cm/100.0,10*log10(power*1000));}
  }
  Packet::free(p);
 }
};
static class WclClass:public TclClass {public:WclClass():TclClass("Agent/Field2SimWcl"){} TclObject*create(int,const char*const*)override{return new WclAgent();}} wclClass;
extern "C" int Field2simwcl_Init(Tcl_Interp*){setvbuf(stdout,nullptr,_IONBF,0);return TCL_OK;}
