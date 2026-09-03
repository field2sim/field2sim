import inet.environment.common.PhysicalEnvironment;
import inet.physicallayer.wireless.common.contract.packetlevel.IPathLoss;
import inet.physicallayer.wireless.common.pathloss.*;

simple PropagationParameterVerifier
{
    parameters:
        @class(PropagationParameterVerifier);
}

module CpxRadioMedium
{
    submodules:
        pathLoss: <default("FreeSpacePathLoss")> like IPathLoss;
}

network CpxPropagationVerifier
{
    submodules:
        physicalEnvironment: PhysicalEnvironment;
        radioMedium: CpxRadioMedium;
        verifier: PropagationParameterVerifier;
}
