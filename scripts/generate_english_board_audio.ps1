param(
  [string]$OutputDir = "frontend/public/audio/en",
  [string]$VoiceName = "Microsoft Zira Desktop - English (United States)"
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
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
  "patient" = "Patient"
  "client" = "Client"
  "ticket_number" = "Ticket number"
  "come_room" = "Please proceed to room"
  "come_window" = "Please proceed to window"
  "come_desk" = "Please proceed to desk"
  "proceed_room" = "Please enter room"
  "proceed_window" = "Please proceed to window"
  "proceed_desk" = "Please proceed to desk"
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
  Write-Wav -Text $item.Value -Path (Join-Path $phrasesDir "$($item.Key).wav")
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

Write-Output "English board audio generated in $OutputDir"
