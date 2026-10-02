param(
  [string]$OutputDir = "frontend/public/audio/ru",
  [string]$VoiceName = "Microsoft Irina Desktop - Russian"
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Decode-Base64Utf8 {
  param([string]$Value)

  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

function New-SapiVoice {
  $voice = New-Object -ComObject SAPI.SpVoice
  $token = $voice.GetVoices() | Where-Object { $_.GetDescription() -eq $VoiceName } | Select-Object -First 1

  if (-not $token) {
    throw "Local Windows voice not found: $VoiceName"
  }

  $voice.Voice = $token
  $voice.Rate = 0
  $voice.Volume = 100

  return $voice
}

function Write-Wav {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $voice = New-SapiVoice
  $stream = New-Object -ComObject SAPI.SpFileStream

  try {
    $stream.Open($Path, 3, $false)
    $voice.AudioOutputStream = $stream
    $null = $voice.Speak($Text)
  } finally {
    try { $stream.Close() } catch {}
  }
}

$lettersDir = Join-Path $OutputDir "letters"
$numbersDir = Join-Path $OutputDir "numbers"
$phrasesDir = Join-Path $OutputDir "phrases"

Ensure-Directory $OutputDir
Ensure-Directory $lettersDir
Ensure-Directory $numbersDir
Ensure-Directory $phrasesDir

$phraseMap = [ordered]@{
  "patient" = "0J/QsNGG0LjQtdC90YI="
  "client" = "0JrQu9C40LXQvdGC"
  "ticket_number" = "0KLQsNC70L7QvSDQvdC+0LzQtdGA"
  "come_room" = "0J/QvtC00L7QudC00LjRgtC1INC6INC60LDQsdC40L3QtdGC0YM="
  "come_window" = "0J/QvtC00L7QudC00LjRgtC1INC6INC+0LrQvdGD"
  "come_desk" = "0J/QvtC00L7QudC00LjRgtC1INC6INGB0YLQvtC70YM="
  "proceed_room" = "0J/RgNC+0YXQvtC00LjRgtC1INCyINC60LDQsdC40L3QtdGC"
  "proceed_window" = "0J/RgNC+0YXQvtC00LjRgtC1INC6INC+0LrQvdGD"
  "proceed_desk" = "0J/RgNC+0YXQvtC00LjRgtC1INC6INGB0YLQvtC70YM="
}

$cyrillicLetterMap = [ordered]@{
  "cyr_a" = 0x0410
  "cyr_be" = 0x0411
  "cyr_ve" = 0x0412
  "cyr_ge" = 0x0413
  "cyr_de" = 0x0414
  "cyr_e" = 0x0415
  "cyr_yo" = 0x0401
  "cyr_zhe" = 0x0416
  "cyr_ze" = 0x0417
  "cyr_i" = 0x0418
  "cyr_short_i" = 0x0419
  "cyr_ka" = 0x041A
  "cyr_el" = 0x041B
  "cyr_em" = 0x041C
  "cyr_en" = 0x041D
  "cyr_o" = 0x041E
  "cyr_pe" = 0x041F
  "cyr_er" = 0x0420
  "cyr_es" = 0x0421
  "cyr_te" = 0x0422
  "cyr_u" = 0x0423
  "cyr_ef" = 0x0424
  "cyr_ha" = 0x0425
  "cyr_tse" = 0x0426
  "cyr_che" = 0x0427
  "cyr_sha" = 0x0428
  "cyr_shcha" = 0x0429
  "cyr_hard" = 0x042A
  "cyr_y" = 0x042B
  "cyr_soft" = 0x042C
  "cyr_eh" = 0x042D
  "cyr_yu" = 0x042E
  "cyr_ya" = 0x042F
}

$latinLetterMap = [ordered]@{
  "latin_a" = "A"
  "latin_b" = "B"
  "latin_c" = "C"
  "latin_d" = "D"
  "latin_e" = "E"
  "latin_f" = "F"
  "latin_g" = "G"
  "latin_h" = "H"
  "latin_i" = "I"
  "latin_j" = "J"
  "latin_k" = "K"
  "latin_l" = "L"
  "latin_m" = "M"
  "latin_n" = "N"
  "latin_o" = "O"
  "latin_p" = "P"
  "latin_q" = "Q"
  "latin_r" = "R"
  "latin_s" = "S"
  "latin_t" = "T"
  "latin_u" = "U"
  "latin_v" = "V"
  "latin_w" = "W"
  "latin_x" = "X"
  "latin_y" = "Y"
  "latin_z" = "Z"
}

foreach ($item in $phraseMap.GetEnumerator()) {
  Write-Wav -Text (Decode-Base64Utf8 $item.Value) -Path (Join-Path $phrasesDir "$($item.Key).wav")
}

foreach ($item in $cyrillicLetterMap.GetEnumerator()) {
  Write-Wav -Text ([string][char]$item.Value) -Path (Join-Path $lettersDir "$($item.Key).wav")
}

foreach ($item in $latinLetterMap.GetEnumerator()) {
  Write-Wav -Text $item.Value -Path (Join-Path $lettersDir "$($item.Key).wav")
}

for ($number = 0; $number -le 999; $number += 1) {
  Write-Wav -Text ([string]$number) -Path (Join-Path $numbersDir "$number.wav")

  if ($number % 100 -eq 0) {
    Write-Output "Generated numbers through $number"
  }
}

Write-Output "Russian board audio generated in $OutputDir"
