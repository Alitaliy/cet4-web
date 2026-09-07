param([string]$SkillsRoot = (Join-Path $env:USERPROFILE '.codex\skills'))
$ErrorActionPreference = 'Stop'
$SourceDirectory = Join-Path $PSScriptRoot '..\skills\cet4-vocab-coach'
$TargetDirectory = Join-Path $SkillsRoot 'cet4-vocab-coach'
if (Test-Path -LiteralPath $TargetDirectory) {
    throw "Skill already exists at $TargetDirectory. Review or back it up before replacing it."
}
New-Item -ItemType Directory -Path $SkillsRoot -Force | Out-Null
Copy-Item -LiteralPath $SourceDirectory -Destination $TargetDirectory -Recurse
Write-Output "Installed: $TargetDirectory"
Write-Output 'Open a new Codex conversation and ask to use cet4-vocab-coach.'
