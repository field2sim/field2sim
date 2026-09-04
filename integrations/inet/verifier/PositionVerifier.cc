/*
 * Parser-execution test for Field2Sim's INET adapter.
 *
 * The test reads positions through INET's IMobility interface after the exact
 * adapter fixture has been loaded by BonnMotionMobility. It does not parse the
 * movements file independently.
 */

#include <omnetpp.h>

#include "inet/mobility/contract/IMobility.h"

#include <cmath>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

using namespace omnetpp;

namespace coojapositioner::validation
{

struct Checkpoint
{
    std::string label;
    double timeSeconds;
    int nodeIndex;
    inet::Coord expected;
};

class PositionVerifier : public cSimpleModule
{
  private:
    std::string scenario;
    double tolerance = 1e-6;
    std::vector<Checkpoint> checkpoints;
    int completedChecks = 0;
    bool passed = true;

  protected:
    virtual void initialize() override;
    virtual void handleMessage(cMessage *message) override;

  private:
    std::vector<Checkpoint> mobileCheckpoints() const;
    std::vector<Checkpoint> staticCheckpoints() const;
};

Define_Module(PositionVerifier);

std::vector<Checkpoint>
PositionVerifier::mobileCheckpoints() const
{
    return {
        {"initial", 0.0, 0, inet::Coord(0.0, 0.0, 0.0)},
        {"segment-1-quarter", 0.5, 0, inet::Coord(0.75, -1.0, 0.0)},
        {"segment-1-midpoint", 1.0, 0, inet::Coord(1.5, -2.0, 0.0)},
        {"segment-2-early", 2.5, 0, inet::Coord(2.166666666666667, -4.0, 0.0)},
        {"segment-2-midpoint", 3.5, 0, inet::Coord(0.5, -4.0, 0.0)},
        {"segment-3-early", 5.5, 0, inet::Coord(-2.0, -2.75, 0.0)},
        {"segment-3-midpoint", 7.0, 0, inet::Coord(-2.0, 1.0, 0.0)},
        {"terminal-hold", 9.1, 0, inet::Coord(-2.0, 6.0, 0.0)},
    };
}

std::vector<Checkpoint>
PositionVerifier::staticCheckpoints() const
{
    return {
        {"static-node-0", 0.1, 0, inet::Coord(0.0, 0.0, 0.0)},
        {"static-node-1", 0.1, 1, inet::Coord(12.5, -8.0, 0.0)},
        {"static-node-2", 0.1, 2, inet::Coord(-4.0, -15.25, 0.0)},
    };
}

void
PositionVerifier::initialize()
{
    scenario = par("scenario").stdstringValue();
    tolerance = par("tolerance").doubleValue();
    if (scenario == "mobile")
        checkpoints = mobileCheckpoints();
    else if (scenario == "static")
        checkpoints = staticCheckpoints();
    else
        throw cRuntimeError("Unknown verifier scenario: %s", scenario.c_str());

    for (int index = 0; index < static_cast<int>(checkpoints.size()); index++) {
        auto message = new cMessage(checkpoints[index].label.c_str(), index);
        scheduleAt(SimTime(checkpoints[index].timeSeconds), message);
    }
}

void
PositionVerifier::handleMessage(cMessage *message)
{
    const int checkpointIndex = message->getKind();
    const Checkpoint& checkpoint = checkpoints.at(checkpointIndex);
    cModule *hostModule = getParentModule()->getSubmodule("host", checkpoint.nodeIndex);
    cModule *mobilityModule = hostModule == nullptr ? nullptr : hostModule->getSubmodule("mobility");
    auto mobility = dynamic_cast<inet::IMobility *>(mobilityModule);
    if (mobility == nullptr) {
        std::cout << "INET_CHECK label=" << checkpoint.label
                  << " node=" << checkpoint.nodeIndex
                  << " time_s=" << checkpoint.timeSeconds
                  << " status=FAIL reason=no-imobility-interface" << std::endl;
        passed = false;
    }
    else {
        const inet::Coord& actual = mobility->getCurrentPosition();
        const double dx = actual.x - checkpoint.expected.x;
        const double dy = actual.y - checkpoint.expected.y;
        const double dz = actual.z - checkpoint.expected.z;
        const double error = std::sqrt(dx * dx + dy * dy + dz * dz);
        const bool checkPassed = std::isfinite(error) && error <= tolerance;
        passed = passed && checkPassed;

        std::cout << std::fixed << std::setprecision(9)
                  << "INET_CHECK label=" << checkpoint.label
                  << " node=" << checkpoint.nodeIndex
                  << " time_s=" << checkpoint.timeSeconds
                  << " expected_x=" << checkpoint.expected.x
                  << " expected_y=" << checkpoint.expected.y
                  << " expected_z=" << checkpoint.expected.z
                  << " actual_x=" << actual.x
                  << " actual_y=" << actual.y
                  << " actual_z=" << actual.z
                  << " error_m=" << error
                  << " status=" << (checkPassed ? "PASS" : "FAIL") << std::endl;
    }

    delete message;
    completedChecks++;
    if (completedChecks == static_cast<int>(checkpoints.size())) {
        std::cout << "INET_RESULT scenario=" << scenario
                  << " checks=" << completedChecks
                  << " status=" << (passed ? "PASS" : "FAIL") << std::endl;
        if (!passed)
            throw cRuntimeError("INET position verification failed for scenario '%s'", scenario.c_str());
        endSimulation();
    }
}

} // namespace coojapositioner::validation
