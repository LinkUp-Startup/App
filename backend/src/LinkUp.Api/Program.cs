using System.Text.Json;
using System.Text.Json.Serialization;
using LinkUp.Api.Data;
using LinkUp.Api.Middleware;
using Microsoft.AspNetCore.HttpLogging;
using LinkUp.Api.Options;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var corsOptions = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();

var enumConverter = new JsonStringEnumConverter(JsonNamingPolicy.CamelCase);
builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(enumConverter));
// The OpenAPI generator reads the minimal-API options, so register the converter there too to document enums as strings.
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(enumConverter));
builder.Services.AddOpenApi();
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
var connectionString = PostgresConnectionString.Normalize(
    builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException(
        "Connection string 'Default' is not configured. Set ConnectionStrings__Default (see backend/README.md)."));
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

builder.Services.AddScoped<IPlanService, StubPlanService>();
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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "LinkUp.Api v1"));
}

app.MapControllers();

app.Run();
