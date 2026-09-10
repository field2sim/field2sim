/*
 * Parser-execution test for Field2Sim's ns-3 adapter.
 *
 * This program deliberately checks MobilityModel state after loading the
 * adapter artifact through ns3::Ns2MobilityHelper. It does not re-parse the
 * Tcl trace itself.
 */

#include "ns3/core-module.h"
#include "ns3/mobility-module.h"
#include "ns3/ns2-mobility-helper.h"

#include <cmath>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

using namespace ns3;

namespace
{

struct Checkpoint
{
    std::string label;
    double timeSeconds;
    uint32_t nodeIndex;
    Vector expected;
};

bool g_passed = true;
double g_tolerance = 1e-6;

void
CheckPosition(Ptr<Node> node, Checkpoint checkpoint)
{
    const Ptr<MobilityModel> mobility = node->GetObject<MobilityModel>();
    if (!mobility)
    {
        std::cout << "NS3_CHECK label=" << checkpoint.label
                  << " node=" << checkpoint.nodeIndex
                  << " time_s=" << checkpoint.timeSeconds
                  << " status=FAIL reason=no-mobility-model" << std::endl;
        g_passed = false;
        return;
    }

    const Vector actual = mobility->GetPosition();
    const double dx = actual.x - checkpoint.expected.x;
    const double dy = actual.y - checkpoint.expected.y;
    const double dz = actual.z - checkpoint.expected.z;
    const double error = std::sqrt(dx * dx + dy * dy + dz * dz);
    const bool passed = std::isfinite(error) && error <= g_tolerance;
    g_passed = g_passed && passed;

    std::cout << std::fixed << std::setprecision(9)
              << "NS3_CHECK label=" << checkpoint.label
              << " node=" << checkpoint.nodeIndex
              << " time_s=" << checkpoint.timeSeconds
              << " expected_x=" << checkpoint.expected.x
              << " expected_y=" << checkpoint.expected.y
              << " expected_z=" << checkpoint.expected.z
              << " actual_x=" << actual.x
              << " actual_y=" << actual.y
              << " actual_z=" << actual.z
              << " error_m=" << error
              << " status=" << (passed ? "PASS" : "FAIL") << std::endl;
}

std::vector<Checkpoint>
MobileCheckpoints()
{
    return {
        {"initial", 0.0, 0, Vector(0.0, 0.0, 0.0)},
        {"segment-1-quarter", 0.5, 0, Vector(0.75, -1.0, 0.0)},
        {"segment-1-midpoint", 1.0, 0, Vector(1.5, -2.0, 0.0)},
        {"segment-2-early", 2.5, 0, Vector(2.1666666665, -4.0, 0.0)},
        {"segment-2-midpoint", 3.5, 0, Vector(0.5, -4.0, 0.0)},
        {"segment-3-early", 5.5, 0, Vector(-2.0, -2.75, 0.0)},
        {"segment-3-midpoint", 7.0, 0, Vector(-2.0, 1.0, 0.0)},
        {"terminal-hold", 9.1, 0, Vector(-2.0, 6.0, 0.0)},
    };
}

std::vector<Checkpoint>
StaticCheckpoints()
{
    return {
        {"static-node-0", 0.1, 0, Vector(0.0, 0.0, 0.0)},
        {"static-node-1", 0.1, 1, Vector(12.5, -8.0, 0.0)},
        {"static-node-2", 0.1, 2, Vector(-4.0, -15.25, 0.0)},
    };
}

} // namespace

int
main(int argc, char* argv[])
{
    std::string traceFile;
    std::string scenario;

    CommandLine cmd(__FILE__);
    cmd.AddValue("traceFile", "Adapter-generated ns-2 mobility trace", traceFile);
    cmd.AddValue("scenario", "Expected fixture: mobile or static", scenario);
    cmd.AddValue("tolerance", "Maximum Euclidean position error in metres", g_tolerance);
    cmd.Parse(argc, argv);

    if (traceFile.empty() || (scenario != "mobile" && scenario != "static") ||
        !std::isfinite(g_tolerance) || g_tolerance < 0.0)
    {
        std::cerr << "Required arguments: --traceFile=<path> --scenario=mobile|static "
                     "[--tolerance=1e-6]"
                  << std::endl;
        return 2;
    }

    const std::vector<Checkpoint> checkpoints =
        scenario == "mobile" ? MobileCheckpoints() : StaticCheckpoints();
    const uint32_t nodeCount = scenario == "mobile" ? 1 : 3;

    NodeContainer nodes;
    nodes.Create(nodeCount);

    Ns2MobilityHelper helper(traceFile);
    helper.Install(nodes.Begin(), nodes.End());

    for (const Checkpoint& checkpoint : checkpoints)
    {
        Simulator::Schedule(Seconds(checkpoint.timeSeconds),
                            &CheckPosition,
                            nodes.Get(checkpoint.nodeIndex),
                            checkpoint);
    }

    const double stopTime = scenario == "mobile" ? 9.2 : 0.2;
    Simulator::Stop(Seconds(stopTime));
    Simulator::Run();
    Simulator::Destroy();

    std::cout << "NS3_RESULT scenario=" << scenario
              << " checks=" << checkpoints.size()
              << " status=" << (g_passed ? "PASS" : "FAIL") << std::endl;
    return g_passed ? 0 : 1;
}
