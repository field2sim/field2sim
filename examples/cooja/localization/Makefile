CONTIKI_PROJECT = anchor-wcl
all: $(CONTIKI_PROJECT)
MAKE_NET = MAKE_NET_NULLNET
MAKE_MAC = MAKE_MAC_CSMA
LDLIBS += -lm
CONTIKI ?= $(CONTIKI_NG)
ifeq ($(strip $(CONTIKI)),)
$(error Set CONTIKI_NG to your Contiki-NG installation)
endif
include $(CONTIKI)/Makefile.include
