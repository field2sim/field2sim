simple PositionVerifier
{
    parameters:
        string scenario;
        double tolerance @unit(m) = default(1e-6m);
        @class(coojapositioner::validation::PositionVerifier);
}
