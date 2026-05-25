using Iso8583Toolkit.Api.Services;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.Simulator.Broker;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(
        new System.Text.Json.Serialization.JsonStringEnumConverter(
            System.Text.Json.JsonNamingPolicy.CamelCase, allowIntegerValues: true)));
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IsoParseService>();
builder.Services.AddSingleton<IsoValidateService>();
builder.Services.AddSingleton<IsoBuildService>();
builder.Services.AddSingleton<ICardDataProvider, CardDataProvider>();
builder.Services.AddSingleton<SmartIsoBuilder>();
builder.Services.AddSingleton<SimulatorBroker>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.Title = "ISO 8583 Toolkit API";
        options.Theme = ScalarTheme.DeepSpace;
        options.DefaultHttpClient = new(ScalarTarget.CSharp, ScalarClient.HttpClient);
    });
}

app.UseWebSockets();
app.UseHttpsRedirection();
app.MapControllers();
app.MapHub<BrokerHub>("/hubs/simulator");

app.Run();
