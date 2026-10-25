using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace LinkUp.Api.OpenApi;

/// <summary>
/// Documents the JWT bearer scheme and marks every [Authorize] endpoint as needing it, so Swagger UI shows an
/// Authorize button and the generated app types know which calls need a token.
/// </summary>
public static class BearerSecurityTransformer
{
    private const string SchemeName = "Bearer";

    public static OpenApiOptions AddBearerSecurity(this OpenApiOptions options)
    {
        options.AddDocumentTransformer((document, _, _) =>
        {
            document.Components ??= new OpenApiComponents();
            document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
            document.Components.SecuritySchemes[SchemeName] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "The accessToken returned by /api/auth/login or /api/auth/register.",
            };
            return Task.CompletedTask;
        });

        options.AddOperationTransformer((operation, context, _) =>
        {
            var needsToken = context.Description.ActionDescriptor.EndpointMetadata.OfType<IAuthorizeData>().Any();
            if (needsToken)
            {
                operation.Security ??= [];
                operation.Security.Add(new OpenApiSecurityRequirement
                {
                    [new OpenApiSecuritySchemeReference(SchemeName, context.Document)] = [],
                });
            }
            return Task.CompletedTask;
        });

        return options;
    }
}
