# Multi-stage build for the LinkUp API. Works on ARM64 (the VPS) and x86-64 (laptops):
# the official .NET images are multi-arch. The build stage always runs on the build machine's own
# architecture (the publish output is architecture-independent, and .NET crashes under QEMU emulation);
# only the runtime stage is built for the target architecture.
# Build context is backend/:  docker build -t linkup-api backend

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so this layer is cached until a .csproj or global.json changes.
COPY global.json ./
COPY src/LinkUp.Api/LinkUp.Api.csproj src/LinkUp.Api/
RUN dotnet restore src/LinkUp.Api/LinkUp.Api.csproj

COPY src/LinkUp.Api/ src/LinkUp.Api/
# OpenApiGenerateDocuments=false: the build-time OpenAPI export writes to the repo's shared/ folder,
# which is not part of this build context.
RUN dotnet publish src/LinkUp.Api/LinkUp.Api.csproj -c Release -o /app/publish \
    --no-restore -p:UseAppHost=false -p:OpenApiGenerateDocuments=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# The aspnet image listens on 8080 by default (ASPNETCORE_HTTP_PORTS); the Dokploy domain/proxy points here.
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# The aspnet image ships a non-root "app" user; never run as root.
USER $APP_UID

ENTRYPOINT ["dotnet", "LinkUp.Api.dll"]
