# syntax=docker/dockerfile:1.6
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish agent/Iso8583Toolkit.Backend/Iso8583Toolkit.Backend.csproj \
    -c Release -o /app/publish \
    --self-contained false \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Agent__Port=8080
EXPOSE 8080
EXPOSE 8583
ENTRYPOINT ["dotnet", "Iso8583Toolkit.Backend.dll"]
