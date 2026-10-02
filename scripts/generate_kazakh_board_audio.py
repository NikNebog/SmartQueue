import argparse
import asyncio
from pathlib import Path

import edge_tts


DEFAULT_OUTPUT_DIR = Path("frontend/public/audio/kk")
DEFAULT_VOICE = "kk-KZ-AigulNeural"

PHRASES = {
    "patient": "Пациент",
    "client": "Клиент",
    "ticket_number": "Талон нөмірі",
    "come_room": "кабинетке келіңіз",
    "come_window": "терезеге келіңіз",
    "come_desk": "үстелге келіңіз",
    "proceed_room": "кабинетке кіріңіз",
    "proceed_window": "терезеге өтіңіз",
    "proceed_desk": "үстелге өтіңіз",
}

LETTERS = {
    "a_ru": "А",
    "be_ru": "Бе",
    "ve_ru": "Ве",
    "ge_ru": "Ге",
    "de_ru": "Де",
    "e_ru": "Е",
    "yo_ru": "Ё",
    "zhe_ru": "Же",
    "ze_ru": "Зе",
    "i_ru": "И",
    "short_i_ru": "Й",
    "ka_ru": "Ка",
    "el_ru": "Эл",
    "em_ru": "Эм",
    "en_ru": "Эн",
    "o_ru": "О",
    "pe_ru": "Пе",
    "er_ru": "Эр",
    "es_ru": "Эс",
    "te_ru": "Те",
    "u_ru": "У",
    "ef_ru": "Эф",
    "ha_ru": "Ха",
    "tse_ru": "Це",
    "che_ru": "Че",
    "sha_ru": "Ша",
    "sha2_ru": "Ща",
    "hard_ru": "Қатты белгі",
    "y_ru": "Ы",
    "soft_ru": "Жіңішкелік белгісі",
    "ae_ru": "Э",
    "yu_ru": "Ю",
    "ya_ru": "Я",
}

UNITS = {
    0: "нөл",
    1: "бір",
    2: "екі",
    3: "үш",
    4: "төрт",
    5: "бес",
    6: "алты",
    7: "жеті",
    8: "сегіз",
    9: "тоғыз",
}

TENS = {
    10: "он",
    20: "жиырма",
    30: "отыз",
    40: "қырық",
    50: "елу",
    60: "алпыс",
    70: "жетпіс",
    80: "сексен",
    90: "тоқсан",
}

HUNDREDS = {
    100: "жүз",
    200: "екі жүз",
    300: "үш жүз",
    400: "төрт жүз",
    500: "бес жүз",
    600: "алты жүз",
    700: "жеті жүз",
    800: "сегіз жүз",
    900: "тоғыз жүз",
}


def number_to_kazakh(number: int) -> str:
    if number == 1000:
        return "мың"

    if number < 10:
        return UNITS[number]

    if number < 100:
        tens = number // 10 * 10
        unit = number % 10
        return TENS[tens] if unit == 0 else f"{TENS[tens]} {UNITS[unit]}"

    hundreds = number // 100 * 100
    rest = number % 100
    return HUNDREDS[hundreds] if rest == 0 else f"{HUNDREDS[hundreds]} {number_to_kazakh(rest)}"


async def synthesize_text(
    semaphore: asyncio.Semaphore,
    text: str,
    output_path: Path,
    voice: str,
    rate: str,
    volume: str,
) -> None:
    async with semaphore:
      output_path.parent.mkdir(parents=True, exist_ok=True)
      communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, volume=volume)
      await communicate.save(str(output_path))


async def generate_audio(output_dir: Path, voice: str, rate: str, volume: str, concurrency: int) -> None:
    semaphore = asyncio.Semaphore(concurrency)
    tasks: list[asyncio.Task[None]] = []

    for name, text in PHRASES.items():
        tasks.append(asyncio.create_task(
            synthesize_text(semaphore, text, output_dir / "phrases" / f"{name}.mp3", voice, rate, volume)
        ))

    for name, text in LETTERS.items():
        tasks.append(asyncio.create_task(
            synthesize_text(semaphore, text, output_dir / "letters" / f"{name}.mp3", voice, rate, volume)
        ))

    for number in range(0, 1001):
        tasks.append(asyncio.create_task(
            synthesize_text(
                semaphore,
                number_to_kazakh(number),
                output_dir / "numbers" / f"{number}.mp3",
                voice,
                rate,
                volume,
            )
        ))

    completed = 0
    for task in asyncio.as_completed(tasks):
        await task
        completed += 1
        if completed % 100 == 0:
            print(f"Generated {completed}/{len(tasks)} files")

    print(f"Kazakh board audio generated in {output_dir}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Kazakh MP3 audio files for SmartQ board announcements.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--rate", default="+0%")
    parser.add_argument("--volume", default="+0%")
    parser.add_argument("--concurrency", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(generate_audio(args.output_dir, args.voice, args.rate, args.volume, max(1, args.concurrency)))


if __name__ == "__main__":
    main()
