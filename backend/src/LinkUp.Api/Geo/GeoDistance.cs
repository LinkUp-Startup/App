namespace LinkUp.Api.Geo;

// Straight-line distances on the Earth's surface
public static class GeoDistance
{
    // Earth radius in kilometres
    public const double EarthRadiusKm = 6371.0;

    // Distance in kilometres between two points given in degrees using the Haversine formula
    // Throws if a latitude is outside -90..90 or a longitude outside -180..180
    public static double HaversineKm(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        Validate(latitude1, longitude1);
        Validate(latitude2, longitude2);

        var lat1 = ToRadians(latitude1);
        var lat2 = ToRadians(latitude2);
        var deltaLat = lat2 - lat1;
        var deltaLon = ToRadians(longitude2 - longitude1);

        var a = Math.Pow(Math.Sin(deltaLat / 2), 2)
            + Math.Cos(lat1) * Math.Cos(lat2) * Math.Pow(Math.Sin(deltaLon / 2), 2);

        // Min guards against rounding pushing a just above 1 for (nearly) opposite points
        return 2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;

    private static void Validate(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90 || double.IsNaN(latitude))
            throw new ArgumentOutOfRangeException(nameof(latitude), latitude, "Latitude must be between -90 and 90.");
        if (longitude is < -180 or > 180 || double.IsNaN(longitude))
            throw new ArgumentOutOfRangeException(nameof(longitude), longitude, "Longitude must be between -180 and 180.");
    }
}