using LinkUp.Api.Geo;

namespace LinkUp.Api.Tests;

public sealed class GeoDistanceTests
{
    [Theory]
    // Real-world distances between city centres
    [InlineData(48.8566, 2.3522, 51.5074, -0.1278, 343.56)]   // Paris – London
    [InlineData(41.6176, 0.6200, 41.3874, 2.1686, 131.48)]    // Lleida – Barcelona
    // Two venues from the dataset: Pub Legend – On The Rocks.
    [InlineData(41.6261973, 0.6226535, 41.6061111, 0.6225, 2.23)]
    public void Known_distances(double lat1, double lon1, double lat2, double lon2, double expectedKm) =>
        Assert.Equal(expectedKm, GeoDistance.HaversineKm(lat1, lon1, lat2, lon2), 0.01);

    [Theory]
    [InlineData(0, 0, 1, 0)]   // One degree of latitude
    [InlineData(0, 0, 0, 1)]   // One degree of longitude at the equator
    public void One_degree_is_one_360th_of_the_circumference(double lat1, double lon1, double lat2, double lon2)
    {
        var expected = 2 * Math.PI * GeoDistance.EarthRadiusKm / 360;  // ≈ 111.19 km

        Assert.Equal(expected, GeoDistance.HaversineKm(lat1, lon1, lat2, lon2), 1e-6);
    }

    [Theory]
    [InlineData(0, 0, 0, 180)]   // Opposite sides of the equator
    [InlineData(90, 0, -90, 0)]  // Pole to pole
    public void Opposite_points_are_half_the_circumference_apart(double lat1, double lon1, double lat2, double lon2) =>
        Assert.Equal(Math.PI * GeoDistance.EarthRadiusKm, GeoDistance.HaversineKm(lat1, lon1, lat2, lon2), 1e-6);

    [Fact]
    public void Same_point_is_zero() =>
        Assert.Equal(0, GeoDistance.HaversineKm(41.6176, 0.62, 41.6176, 0.62));

    [Fact]
    public void Order_of_the_points_does_not_matter() =>
        Assert.Equal(
            GeoDistance.HaversineKm(48.8566, 2.3522, 51.5074, -0.1278),
            GeoDistance.HaversineKm(51.5074, -0.1278, 48.8566, 2.3522),
            1e-9);

    [Fact]
    public void Crossing_the_date_line_takes_the_short_way() =>
        // 179.5°E to 179.5°W is 1 degree apart, not 359
        Assert.Equal(111.19, GeoDistance.HaversineKm(0, 179.5, 0, -179.5), 0.01);

    [Theory]
    [InlineData(91, 0)]
    [InlineData(-91, 0)]
    [InlineData(0, 181)]
    [InlineData(0, -181)]
    [InlineData(double.NaN, 0)]
    public void Invalid_coordinates_are_rejected(double latitude, double longitude) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => GeoDistance.HaversineKm(latitude, longitude, 0, 0));
}