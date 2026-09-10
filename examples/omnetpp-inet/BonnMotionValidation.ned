import inet.mobility.single.BonnMotionMobility;

module ValidationHost
{
    parameters:
        int nodeId;
        string traceFile;
        @networkNode();
    submodules:
        mobility: BonnMotionMobility {
            parameters:
                nodeId = parent.nodeId;
                traceFile = parent.traceFile;
                is3D = false;
                updateInterval = 0s;
        }
}

network MobileValidation
{
    submodules:
        host[1]: ValidationHost {
            parameters:
                nodeId = index;
        }
        verifier: PositionVerifier {
            parameters:
                scenario = "mobile";
        }
}

network StaticValidation
{
    submodules:
        host[3]: ValidationHost {
            parameters:
                nodeId = index;
        }
        verifier: PositionVerifier {
            parameters:
                scenario = "static";
        }
}
