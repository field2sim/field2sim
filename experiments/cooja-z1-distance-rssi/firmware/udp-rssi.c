#include "contiki.h"
#include "net/ipv6/simple-udp.h"
#include "net/ipv6/uip.h"
#include "net/ipv6/uipbuf.h"
#include "sys/etimer.h"
#include "sys/node-id.h"

#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define UDP_PORT 5678
#define SENDER_MOTE_ID 1
#define RECEIVER_MOTE_ID 2
#define WARMUP_TIME (5 * CLOCK_SECOND)
#define SEND_INTERVAL (CLOCK_SECOND / 4)

static struct simple_udp_connection udp_connection;

PROCESS(udp_rssi_process, "Z1 UDP distance-RSSI probe");
AUTOSTART_PROCESSES(&udp_rssi_process);

static void
udp_rx_callback(struct simple_udp_connection *connection,
                const uip_ipaddr_t *sender_addr,
                uint16_t sender_port,
                const uip_ipaddr_t *receiver_addr,
                uint16_t receiver_port,
                const uint8_t *data,
                uint16_t datalen)
{
  uint32_t network_sequence;
  uint32_t sequence;
  int16_t rssi;

  (void)connection;
  (void)sender_addr;
  (void)sender_port;
  (void)receiver_addr;
  (void)receiver_port;

  if(node_id != RECEIVER_MOTE_ID || datalen != sizeof(network_sequence)) {
    return;
  }

  memcpy(&network_sequence, data, sizeof(network_sequence));
  sequence = uip_ntohl(network_sequence);
  rssi = (int16_t)uipbuf_get_attr(UIPBUF_ATTR_RSSI);
  printf("RSSI_SAMPLE seq=%" PRIu32 " rssi=%d\n", sequence, (int)rssi);
}

PROCESS_THREAD(udp_rssi_process, ev, data)
{
  static struct etimer send_timer;
  static uint32_t sequence;
  static uint32_t network_sequence;
  static uip_ipaddr_t multicast_address;

  PROCESS_BEGIN();

  printf("APP_START node=%u\n", node_id);
  simple_udp_register(&udp_connection, UDP_PORT, NULL, UDP_PORT,
                      udp_rx_callback);
  uip_create_linklocal_allnodes_mcast(&multicast_address);

  if(node_id == SENDER_MOTE_ID) {
    etimer_set(&send_timer, WARMUP_TIME);
    while(1) {
      PROCESS_WAIT_EVENT_UNTIL(etimer_expired(&send_timer));
      network_sequence = UIP_HTONL(sequence);
      simple_udp_sendto(&udp_connection, &network_sequence,
                        sizeof(network_sequence), &multicast_address);
      printf("TX_SAMPLE seq=%" PRIu32 "\n", sequence);
      sequence++;
      etimer_set(&send_timer, SEND_INTERVAL);
    }
  }

  PROCESS_END();
}
