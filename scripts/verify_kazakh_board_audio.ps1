param(
  [string]$AudioDir = "frontend/public/audio/kk"
)

$ErrorActionPreference = "Stop"

$requiredPhrases = @(
  "client",
  "come_desk",
  "come_room",
  "come_window",
  "patient",
  "proceed_desk",
  "proceed_room",
  "proceed_window",
  "ticket_number"
)

$requiredLetters = @(
  "a_ru",
  "ae_ru",
  "be_ru",
  "che_ru",
  "de_ru",
  "e_ru",
  "ef_ru",
  "el_ru",
  "em_ru",
  "en_ru",
  "er_ru",
  "es_ru",
  "ge_ru",
  "ha_ru",
  "hard_ru",
  "i_ru",
  "ka_ru",
  "o_ru",
  "pe_ru",
  "sha_ru",
  "sha2_ru",
  "short_i_ru",
  "soft_ru",
  "te_ru",
  "tse_ru",
  "u_ru",
  "ve_ru",
  "y_ru",
  "ya_ru",
  "yo_ru",
  "yu_ru",
  "ze_ru",
  "zhe_ru"
)

$missing = New-Object System.Collections.Generic.List[string]

foreach ($phrase in $requiredPhrases) {
  $path = Join-Path $AudioDir "phrases/$phrase.mp3"

  if (-not (Test-Path -LiteralPath $path)) {
    $missing.Add($path)
  }
}

foreach ($letter in $requiredLetters) {
  $path = Join-Path $AudioDir "letters/$letter.mp3"

  if (-not (Test-Path -LiteralPath $path)) {
    $missing.Add($path)
  }
}

for ($number = 0; $number -le 1000; $number += 1) {
  $path = Join-Path $AudioDir "numbers/$number.mp3"

  if (-not (Test-Path -LiteralPath $path)) {
    $missing.Add($path)
  }
}

if ($missing.Count -gt 0) {
  Write-Error "Kazakh board audio is incomplete. Missing files:`n$($missing -join "`n")"
}

Write-Output "Kazakh board audio is complete in $AudioDir"
