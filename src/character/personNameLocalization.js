const RUSSIAN_NAME_OVERRIDES = Object.freeze({
  Mira: "Мира", Rowan: "Роуэн", Ilya: "Илья", Anya: "Аня", Tomas: "Томас", Lida: "Лида",
  Pavel: "Павел", Vera: "Вера", Niko: "Нико", Sonya: "Соня", Emil: "Эмиль", Daria: "Дарья",
  Mark: "Марк", Nina: "Нина", Lev: "Лев", Zoya: "Зоя",
  Maria: "Мария", Anna: "Анна", Daniel: "Даниэль", Eva: "Ева", Robert: "Роберт", David: "Давид",
  Michael: "Майкл", Peter: "Питер", Erik: "Эрик", Helena: "Хелена", Sara: "Сара", John: "Джон",
  Anita: "Анита", Andrea: "Андреа", Laura: "Лаура", Adam: "Адам", William: "Уильям", Sofia: "София",
  James: "Джеймс", Emma: "Эмма", Jennifer: "Дженнифер", Richard: "Ричард", Amanda: "Аманда",
  Julia: "Юлия", Alexander: "Александр", Jessica: "Джессика", Michelle: "Мишель", Kevin: "Кевин",
  Agnes: "Агнес", Samuel: "Самуэль", Lisa: "Лиза", Alexandra: "Александра", Anne: "Анна",
  Benjamin: "Бенджамин", Brian: "Брайан", Joseph: "Джозеф", Eric: "Эрик", Marta: "Марта",
  Barbara: "Барбара", Sarah: "Сара", Linda: "Линда", Alice: "Алиса", Rita: "Рита", Ida: "Ида",
  Gabriel: "Габриэль", Sandra: "Сандра", Christina: "Кристина", Patricia: "Патриция", Alex: "Алекс",
  Karin: "Карин", Olivia: "Оливия", Victoria: "Виктория", Sebastian: "Себастьян", Matthew: "Мэттью",
  Hanna: "Ханна", Simon: "Саймон", Angela: "Анджела", Kenneth: "Кеннет", Bruno: "Бруно",
  Nora: "Нора", Lucas: "Лукас", Paul: "Пол", Elizabeth: "Элизабет", Anthony: "Энтони",
  Adrian: "Адриан", Jonas: "Йонас", Albert: "Альберт", Robin: "Робин", Hans: "Ханс", Jason: "Джейсон",
  Karen: "Карен", Christian: "Кристиан", Jonathan: "Джонатан", Ryan: "Райан", Joshua: "Джошуа",
  Ashley: "Эшли", Charles: "Чарльз", Igor: "Игорь", Ivan: "Иван", Diana: "Диана", Roger: "Роджер",
  Leon: "Леон", Christine: "Кристина", Mary: "Мэри", Victor: "Виктор", Steven: "Стивен",
  Caroline: "Каролина", Cecilia: "Сесилия", Louise: "Луиза", Petra: "Петра", Oliver: "Оливер",
  Bryan: "Брайан", Monica: "Моника", Joel: "Джоэл", Patrick: "Патрик", Alicia: "Алисия",
  Rebecca: "Ребекка", Amy: "Эми", Gabriella: "Габриэлла", Astrid: "Астрид", Kelly: "Келли",
  Susan: "Сьюзан", Teresa: "Тереза", Andrew: "Эндрю", Roland: "Роланд", Jacob: "Джейкоб",
  Olga: "Ольга", Hugo: "Хьюго", Denis: "Денис", Viktoria: "Виктория", Artur: "Артур",
  Sophie: "Софи", Emily: "Эмили", Andreas: "Андреас", Charlotte: "Шарлотта", Erica: "Эрика",
  Magnus: "Магнус", Fredrik: "Фредрик", Elina: "Элина", Kimberly: "Кимберли", Heidi: "Хайди",
  Isaac: "Айзек", Timothy: "Тимоти", Arthur: "Артур", Marcel: "Марсель", Oskar: "Оскар",
  Antonio: "Антонио", Jenny: "Дженни", Noah: "Ноа", Jeffrey: "Джеффри", Justin: "Джастин",
  Frank: "Фрэнк", Jacqueline: "Жаклин", Henry: "Генри", Lara: "Лара", Bianca: "Бьянка",
  Danielle: "Даниэль", Elias: "Элиас", Gabriela: "Габриэла", Julian: "Джулиан", Vincent: "Винсент",
  Aaron: "Аарон", Paula: "Паула", Ellen: "Эллен", Viktor: "Виктор", Elisa: "Элиза", Elise: "Элиз",
  Tom: "Том", Camilla: "Камилла", Tina: "Тина", Clara: "Клара", Daniela: "Даниэла", Lena: "Лена",
  Carolina: "Каролина", Ruth: "Рут", Mathias: "Матиас", Mia: "Мия", Isabella: "Изабелла",
  Jean: "Жан", Otto: "Отто", Veronika: "Вероника", Leonardo: "Леонардо", Josephine: "Жозефина",
  Megan: "Меган", Alan: "Алан", Emanuel: "Эмануэль", Rafael: "Рафаэль", Rene: "Рене",
  Tommy: "Томми", Catherine: "Кэтрин", Brandon: "Брэндон", Luisa: "Луиза", Marcus: "Маркус",
  Hannah: "Ханна", Luna: "Луна", Luca: "Лука", Brenda: "Бренда", Margaret: "Маргарет",
  Lauren: "Лорен", Bernardo: "Бернардо", Gustavo: "Густаво", Miguel: "Мигель", Amber: "Эмбер",
  Melanie: "Мелани", Natalie: "Натали", Philip: "Филип", Raymond: "Рэймонд", Rachel: "Рэйчел",
  Magdalena: "Магдалена", Ana: "Ана", Amelia: "Амелия", Aurora: "Аврора", Adriana: "Адриана",
  Francisco: "Франсиско", Oscar: "Оскар", Xavier: "Ксавьер", Ian: "Иэн", Samantha: "Саманта",
  Stephen: "Стивен", Diane: "Диана", Sonia: "Соня", Fabian: "Фабиан", Matilda: "Матильда",
});

const DIGRAPHS = Object.freeze([
  ["shch", "щ"], ["sch", "щ"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"], ["ch", "ч"],
  ["sh", "ш"], ["ya", "я"], ["yu", "ю"], ["yo", "ё"], ["ph", "ф"], ["th", "т"],
  ["ck", "к"], ["qu", "кв"], ["ee", "и"], ["oo", "у"],
]);
const LETTERS = Object.freeze({
  a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "дж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т",
  u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з",
});

export function localizePersonDisplayName(value, language = currentPersonNameLanguage()) {
  const name = String(value ?? "").trim();
  if (!name || language !== "ru") return name;
  return RUSSIAN_NAME_OVERRIDES[name] ?? transliterateName(name);
}

export function currentPersonNameLanguage() {
  if (typeof document === "undefined") return "en";
  return String(document.documentElement?.lang ?? "en").toLowerCase().startsWith("ru") ? "ru" : "en";
}

function transliterateName(value) {
  const lower = value.toLowerCase();
  let index = 0;
  let result = "";
  while (index < lower.length) {
    let matched = false;
    for (const [latin, cyrillic] of DIGRAPHS) {
      if (!lower.startsWith(latin, index)) continue;
      result += cyrillic;
      index += latin.length;
      matched = true;
      break;
    }
    if (matched) continue;
    const character = lower[index];
    result += LETTERS[character] ?? character;
    index += 1;
  }
  if (/^[Ee]/.test(value)) result = `э${result.slice(1)}`;
  return result ? result[0].toUpperCase() + result.slice(1) : result;
}
