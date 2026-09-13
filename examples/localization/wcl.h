#ifndef FIELD2SIM_WCL_H
#define FIELD2SIM_WCL_H
#include <math.h>
#include <stdint.h>
#define WCL_SITES 8
/* Payload contains only anchor observations, never unknown-node coordinates. */
typedef struct { uint16_t magic, seq, site; int16_t x_cm, y_cm; } Beacon;
typedef struct { double power_sum[WCL_SITES]; unsigned count[WCL_SITES]; double x[WCL_SITES], y[WCL_SITES]; unsigned long seen; } Wcl;
static int wcl_add(Wcl *s, const Beacon *b, double rssi) {
 if(b->magic!=0xF251 || b->site>=WCL_SITES || b->seq>=16 || !(rssi >= -200 && rssi <= 100)) return 0;
 if(s->seen & (1UL<<b->seq)) return 0;
 s->seen |= 1UL<<b->seq;
 /* +60 is a common numerical scale; it cancels from the centroid. */
 #ifdef __MSP430__
 s->power_sum[b->site] += powf(10.0f,(rssi+60.0f)/10.0f);
#else
 s->power_sum[b->site] += pow(10.0,(rssi+60.0)/10.0);
#endif
 s->count[b->site]++;
 s->x[b->site]=b->x_cm/100.0; s->y[b->site]=b->y_cm/100.0;
 return 1;
}
static int wcl_estimate(const Wcl *s, double *x, double *y) {
 int i,n=0; double total=0; *x=0;*y=0;
 for(i=0;i<WCL_SITES;i++) if(s->count[i]) {
  double w=s->power_sum[i]/s->count[i];
  total+=w;*x+=w*s->x[i];*y+=w*s->y[i];n++;
 }
 if(n<3 || !(total>0)) return 0;
 *x/=total;*y/=total;return n;
}
#endif
