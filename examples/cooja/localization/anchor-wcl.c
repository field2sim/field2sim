#include "contiki.h"
#include "net/netstack.h"
#include "net/nullnet/nullnet.h"
#include "net/packetbuf.h"
#include "sys/node-id.h"
#include <stdio.h>
#include <string.h>
#include "wcl.h"
static Wcl state;
static Beacon message;
static unsigned received;
static struct etimer timer;
static unsigned seq;
static unsigned long sec;
static const int16_t route[8][2]={{1000,1000},{5000,1000},{9000,1000},{9000,5000},{9000,9000},{5000,9000},{1000,9000},{1000,5000}};
PROCESS(wcl_process,"Mobile anchor RSSI WCL");
AUTOSTART_PROCESSES(&wcl_process);
static void input(const void *data,uint16_t len,const linkaddr_t *src,const linkaddr_t *dest) {
 Beacon b;int rssi;
 (void)src;(void)dest;
 if(node_id==1 || len!=sizeof b)return;
 memcpy(&b,data,sizeof b);rssi=packetbuf_attr(PACKETBUF_ATTR_RSSI);
 if(wcl_add(&state,&b,rssi)){
  received++;
  printf("RX node=%u seq=%u site=%u ax_cm=%d ay_cm=%d rssi_dbm=%d\n",node_id,b.seq,b.site,b.x_cm,b.y_cm,rssi);
 }
}
PROCESS_THREAD(wcl_process,ev,data){
 PROCESS_BEGIN();
 nullnet_set_input_callback(input);
 /* Restart RX after platform channel configuration, then listen continuously. */
 NETSTACK_MAC.off();
 NETSTACK_MAC.on();
 printf("READY node=%u\n",node_id);
 etimer_set(&timer,CLOCK_SECOND);
 while(1){
  PROCESS_WAIT_EVENT_UNTIL(etimer_expired(&timer));
  sec=clock_seconds();
  if(node_id==1 && seq<16 && sec>=6 && (sec-6)%4<2){
   message.magic=0xF251;message.seq=seq;message.site=seq/2;
   message.x_cm=route[seq/2][0];message.y_cm=route[seq/2][1];
   nullnet_buf=(uint8_t*)&message;nullnet_len=sizeof message;
   NETSTACK_NETWORK.output(NULL);
   printf("TX seq=%u site=%u x_cm=%d y_cm=%d\n",seq,seq/2,message.x_cm,message.y_cm);seq++;
  }
  if(sec>=38){
   if(node_id!=1){
    double x,y;int n=wcl_estimate(&state,&x,&y);
    if(n)printf("EST node=%u sites=%d received=%u x_mm=%ld y_mm=%ld\n",node_id,n,received,(long)(x*1000+0.5),(long)(y*1000+0.5));
    else printf("UNLOCALIZED node=%u received=%u\n",node_id,received);
   }
   break;
  }
  etimer_reset(&timer);
 }
 PROCESS_END();
}
