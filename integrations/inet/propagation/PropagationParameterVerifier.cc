#include <iomanip>
#include <iostream>
#include <string>

#include <omnetpp.h>

using namespace omnetpp;

class PropagationParameterVerifier : public cSimpleModule
{
  protected:
    void initialize() override
    {
        scheduleAt(SIMTIME_ZERO, new cMessage("verify-propagation"));
    }

    void handleMessage(cMessage *message) override
    {
        auto network = getParentModule();
        auto radioMedium = network->getSubmodule("radioMedium");
        auto pathLoss = radioMedium == nullptr ? nullptr : radioMedium->getSubmodule("pathLoss");
        if (pathLoss == nullptr)
            throw cRuntimeError("The verifier could not find radioMedium.pathLoss.");

        auto physicalEnvironment = network->getSubmodule("physicalEnvironment");
        auto ground = physicalEnvironment == nullptr ? nullptr : physicalEnvironment->getSubmodule("ground");
        const char *pathLossType = pathLoss->getComponentType()->getFullName();
        const char *groundType = ground == nullptr ? "NONE" : ground->getComponentType()->getFullName();

        std::cout << std::setprecision(12)
                  << "INET_PROPAGATION_CHECK"
                  << " type=" << pathLossType
                  << " alpha=" << pathLoss->par("alpha").doubleValue()
                  << " sigma=" << (pathLoss->hasPar("sigma") ? std::to_string(pathLoss->par("sigma").doubleValue()) : "NA")
                  << " system_loss_db=" << pathLoss->par("systemLoss").doubleValue()
                  << " ground=" << groundType
                  << std::endl;

        delete message;
        endSimulation();
    }
};

Define_Module(PropagationParameterVerifier);
