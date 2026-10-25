using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using LinkUp.Api.Ai;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Middleware;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Identity;
using LinkUp.Api.OpenApi;
using LinkUp.Api.Options;
using LinkUp.Api.Planning;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;
using LinkUp.Api.Data.Seed;

var builder = WebApplication.CreateBuilder(args);

var corsOptions = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();

var enumConverter = new JsonStringEnumConverter(JsonNamingPolicy.CamelCase);
// Strict numbers: reject "30" for a number field, and document numbers as plain numbers in OpenAPI.
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(enumConverter);
    options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
// The OpenAPI generator reads the minimal-API options, so register the converter there too to document enums as strings.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(enumConverter);
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddOpenApi(options => options.AddBearerSecurity());
builder.Services.AddHttpLogging(options =>
{
    // Log method/path/status plus the request body so submitted forms are visible (issue #26).
    // Revisit before adding login/register endpoints: bodies there contain passwords.
    options.LoggingFields = HttpLoggingFields.RequestMethod | HttpLoggingFields.RequestPath
        | HttpLoggingFields.RequestBody | HttpLoggingFields.ResponseStatusCode;
    options.RequestBodyLogLimit = 4096;
    options.MediaTypeOptions.AddText("application/json");
});
// Local: appsettings.Development.json, or user-secrets to override it. Server: the ConnectionStrings__Default
// environment variable. Both Npgsql (Host=...;) and postgres:// URL formats are accepted.
// Build-time OpenAPI generation (shared/openapi.json) runs this file without configuration and never touches
// the database, so it is allowed to start without a connection string.
var isOpenApiGeneration = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
var connectionString = PostgresConnectionString.Resolve(
    builder.Configuration.GetConnectionString("Default"), allowMissing: isOpenApiGeneration);
builder.Services.AddDbContext<AppDbContext>(options => options
    .UseNpgsql(connectionString)
    // Inserts the curated venues whenever migrations run
    .UseSeeding((context, _) => VenueSeeder.Seed(context))
    .UseAsyncSeeding((context, _, cancellationToken) => VenueSeeder.SeedAsync(context, cancellationToken)));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

builder.Services.Configure<DatabaseOptions>(builder.Configuration.GetSection(DatabaseOptions.SectionName));
builder.Services.AddOptions<PlanGenerationOptions>()
    .Bind(builder.Configuration.GetSection(PlanGenerationOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddAiClient(builder.Configuration);
// Plans come from the AI when a key is configured. Without one a stub keeps local development and tests working.
var aiConfigured = builder.Configuration.GetSection(AiOptions.SectionName).Get<AiOptions>()?.IsConfigured == true;
if (aiConfigured)
    builder.Services.AddScoped<IPlanService, AiPlanService>();
else
    builder.Services.AddScoped<IPlanService, StubPlanService>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IVenueService, VenueService>();
builder.Services.AddScoped<IVenueFilteringService, VenueFilteringService>();

// JWT access tokens (#84). The signing key comes from configuration (Jwt__SigningKey on the server) and is
// validated at startup, so a deploy without it fails loudly instead of running with no or a weak key.
// Build-time OpenAPI generation runs without configuration, so it gets a throwaway key.
if (isOpenApiGeneration)
    builder.Configuration["Jwt:SigningKey"] ??= new string('x', JwtOptions.SigningKeyMinLength);
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        bearer.MapInboundClaims = false; // keep "sub" and "name" as written in the token
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "name",
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    // Native React Native requests send no Origin header, so this only matters for web/Expo web.
    if (corsOptions.AllowedOrigins.Length > 0)
        policy.WithOrigins(corsOptions.AllowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpLogging();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "LinkUp.Api v1"));
}

app.MapControllers();

// Not during build-time OpenAPI generation, which runs this file without a database.
if (!isOpenApiGeneration)
{
    if (!aiConfigured)
        app.Logger.LogWarning("Ai:ApiKey is not set, so /api/plans/generate returns stub plans instead of AI plans.");
    await app.MigrateDatabaseAsync();
}

await app.RunAsync();
