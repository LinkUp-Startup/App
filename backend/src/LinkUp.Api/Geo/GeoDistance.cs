using System.Linq.Expressions;

namespace LinkUp.Api.Geo;

// Straight-line distances on the Earth's surface
public static class GeoDistance
{
    // Earth radius in kilometres
    public const double EarthRadiusKm = 6371.0;

    private const double RadiansPerDegree = Math.PI / 180;

    // One formula for both ordinary calls and database predicates. EF expands this expression
    // and translates its Math operations; it cannot translate an opaque HaversineKm method call.
    // Min protects the asin domain when rounding pushes the antipodal value just above one.
    public static Expression<Func<double, double, double, double, double>> HaversineKmExpression { get; } =
        (latitude1, longitude1, latitude2, longitude2) =>
            2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(
                Math.Pow(Math.Sin((latitude2 - latitude1) * RadiansPerDegree / 2), 2)
                + Math.Cos(latitude1 * RadiansPerDegree) * Math.Cos(latitude2 * RadiansPerDegree)
                * Math.Pow(Math.Sin((longitude2 - longitude1) * RadiansPerDegree / 2), 2))));

    private static readonly Func<double, double, double, double, double> CalculateKm =
        HaversineKmExpression.Compile();

    // Distance in kilometres between two points given in degrees using the Haversine formula
    // Throws if a latitude is outside -90..90 or a longitude outside -180..180
    public static double HaversineKm(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        ValidateCoordinates(latitude1, longitude1);
        ValidateCoordinates(latitude2, longitude2);
        return CalculateKm(latitude1, longitude1, latitude2, longitude2);
    }

    internal static void ValidateCoordinates(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90 || double.IsNaN(latitude))
            throw new ArgumentOutOfRangeException(nameof(latitude), latitude, "Latitude must be between -90 and 90.");
        if (longitude is < -180 or > 180 || double.IsNaN(longitude))
            throw new ArgumentOutOfRangeException(nameof(longitude), longitude, "Longitude must be between -180 and 180.");
    }
}
