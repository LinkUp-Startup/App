using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Options;

public sealed class SharingOptions
{
    public const string SectionName = "Sharing";

    /// <summary>The website that shows shared plans; a share link is this plus <c>/plan/{token}</c>.</summary>
    [Required, Url]
    public string WebBaseUrl { get; init; } = "https://linkup.th7bo.dev";
}
