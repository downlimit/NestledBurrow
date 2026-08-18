// 1000 common given-name variants used by generated residents.
// The pool is deterministic and presentation-safe (ASCII Latin, short single given names).
const NAME_DATA = [
  "Maria|Anna|Daniel|Eva|Robert|David|Laszlo|Juhani|Istvan|Michael|Peter|Erzsebet|Jozsef|Erik|Helena|Sara|Janos|Ilona|John|Zoltan|Anita|Andrea|Katalin|Elisabeth|Johannes|Thomas|Laura|Adam|William|Jan|Mikael|Sofia|James|Erika|Sandor|Emma|Jennifer|Richard|Amanda|Johanna|Gabor|Marie|Nicole|Martin|Ferenc|Karl|Lars|Julia|Christopher|Alexander|Attila|Jessica|Michelle|Olavi|Kevin|Melissa|Anneli|Agnes|Antero|Kristina|Johan|Tamas|Julie|Margit|Samuel|Lisa|Alexandra|Zsuzsanna|Tapani|Anne|Anders|Mark|Benjamin|Emil|Brian|Margareta|Monika|Joseph|Eric|Marta|Barbara|Sarah|Linda|Julianna|Alice|Rita|Marianne|Ida|Gabriel|Zsolt|Sandra|Christina|Tapio|Per|Patricia|Alex|Karin|Nina|Emilia|Olivia",
  "Victoria|Tibor|Klara|Sebastian|Linnea|Matthew|Carl|Nils|Kaarina|Stefan|Hanna|Henrik|Renata|Simon|Birgitta|Stephanie|Angela|Andras|Norbert|Kenneth|Ingrid|Kalevi|Bruno|Elisabet|Nora|Lucas|Paul|Elizabeth|Judit|Anthony|Marjatta|Adrian|Jonas|Albert|Robin|Csaba|Ildiko|Kristian|Irene|Hans|Vera|Jason|Karen|Christian|Jonathan|Imre|Hannele|Matias|Ryan|Joshua|Ashley|Charles|Igor|Ivan|Diana|Andre|Roger|Leon|Christine|Mary|Victor|Steven|Jose|Caroline|Cecilia|Gunnar|Louise|Petra|Matti|Lajos|Oliver|Bryan|Monica|Joel|Patrick|Alicia|Rebecca|Amy|Krisztina|Gabriella|Pekka|Astrid|Kelly|Susan|Teresa|Andrew|Gyorgy|Roland|Susanna|Markus|Jacob|Kristiina|Olga|Hugo|Denis|Viktoria|Artur|Rozalia|Sophie|Elin",
  "Emily|Emilie|Liisa|Andreas|Kim|Charlotte|Kari|Erica|Magnus|Fredrik|Elina|Kimberly|Balazs|Petteri|Heidi|Iren|Isaac|Timothy|Janne|Arthur|Marcel|Oskar|Antonio|Ilmari|Jenny|Noah|Jeffrey|Justin|Ann|Frank|Dominik|Suzanne|Jacqueline|Inger|Henry|Lara|Bianca|Danielle|Elias|Eszter|Bjorn|Gabriela|Gyula|Patrik|Leif|Edit|Daniela|Lena|Carolina|Ruth|Julian|Vincent|Tomas|Aaron|Paula|Ellen|Viktor|Sakari|Elisa|Elise|Tom|Camilla|Annikki|Annamaria|Heather|Tuulikki|Tina|Clara|Mihaly|Marika|Alexandre|Magdolna|Marianna|Filip|Bo|Scott|Nathan|Yasmin|Arne|Timo|Zoe|Karoly|Maarit|Isabel|Sofie|Nicholas|Tobias|Sven|Nadia|Susanne|Mariana|Britt|Valerie|Ruben|Pal|Denise|Damian|Bela|Ester|Valentina",
  "Mathias|Szilvia|Rolf|Mia|Isabella|Ulla|Jean|Helene|Otto|Veronika|Leonardo|Josephine|Megan|Alan|Emanuel|Rafael|Rene|Tommy|Catherine|Brandon|Mari|Luisa|Irma|Marcus|Hannah|Luna|Stig|Luca|Brenda|Olof|Antti|Margaret|Gustav|Inga|Lauren|Ines|Bernardo|Gustavo|Miguel|Amber|Melanie|Krisztian|Juha|Natalie|Philip|Raymond|Jens|Rachel|Magdalena|Kamil|Joakim|Ana|Ivo|Lennart|Leonard|Leena|Amelia|Heikki|Nathalie|Aurora|Aniko|Adriana|Francisco|Oscar|Anette|Xavier|Marek|Miklos|Ian|Kristin|Samantha|Jari|Stephen|Diane|Sonia|Malin|Fabian|Matilda|Blanka|Dorota|Hubert|Jozef|Iris|Noemi|Enzo|Fernando|Jorgen|Donna|Katariina|Michal|Dennis|George|Milan|Kjell|Berit|Gregory|Marja|Bence|Nicolas|Therese",
  "Luis|Manuel|Dora|Pedro|Liam|Timea|Annika|Ella|Marc|Jakub|Kamila|Nela|Michele|Lidia|Mario|Elena|Roza|Yvonne|Karina|Bianka|Juliana|Roy|Martine|Eduardo|Felix|Margot|Sinikka|Mika|Milena|Alf|Rune|Jamie|Sam|Leo|Ema|Melania|Aimee|Mikko|Edward|Vanessa|Piroska|Kerstin|Jack|Simone|Minna|Catarina|Dana|Carlos|Stella|Beatriz|Camila|Diego|Isabela|Leandro|Leticia|Lorena|Rafaela|Raquel|Rodrigo|Vicente|Anton|Sophia|Mate|Sami|Inkeri|Sigrid|Helen|Katherine|Ulf|Solveig|Jon|Lucy|Louis|Bengt|Ronald|Lorenzo|Lucia|Marco|Ibolya|Allan|Jenna|Kyle|Isis|Jeremy|Mats|Pamela|Olaf|Pia|Isabelle|Joana|Larissa|Paulo|Carina|Bente|Finn|Mette|Martina|Donald|Melinda|Marita",
  "Linn|Tunde|Kristine|Theo|Riitta|Lucie|Maya|Goran|Jade|Siv|Shannon|Claudio|Tatiana|Jukka|Veronica|Juan|Einar|Deborah|Zsofia|Maurice|Bradley|Marina|Kornel|Toni|Helge|Kyllikki|Eliza|Benjamim|Bruna|Diogo|Eduarda|Guilherme|Henrique|Joao|Joaquim|Luana|Mateus|Valentim|Vitor|Vitoria|Tammy|Kalervo|Thea|Jesse|Valeria|Markku|Elsa|Natalia|Ewa|Claire|Henri|Aleksi|Sean|Marcela|Olivie|Kathleen|Livia|Jill|Tristan|Pauline|Noa|Lina|Jaakko|Rosa|Edith|Fabio|Luciana|Ake|Cynthia|Liv|Bernard|Viola|Aurelia|Mona|Aino|Annette|Tove|Max|Zdenka|Tyler|Tuula|Bertil|Lukas|Kirsten|Petri|Maja|Douglas|Gerard|Ingeborg|Else|Lorraine|Madeleine|Ernest|Gary|Marit|Dawn|Oskari|Ole|Erling|Tracy",
  "Esther|Ricardo|Jorge|Carla|Ragnhild|Angelo|Sandro|Agatha|Apolonia|Gizella|Guy|Adele|Erkki|Paivi|Gergo|Lauri|Sharon|Veikko|Gerd|Szabolcs|Grete|Hanne|Karoline|Lene|Maren|Marius|Orvokki|Mara|Sarka|Stepanka|Vlasta|Amelie|Piotr|Ville|Roman|Alfred|Julius|Beata|Hannu|Tony|Renee|Ase|Ritva|Csilla|Lindsey|Cesar|Keith|Konrad|Pawel|Cathrine|Krzysztof|Tomasz|Angelika|Andrzej|Leah|Seppo|Agnieszka|Tellervo|Chloe|Ola|Torbjorn|Ivar|Danilo|Brittany|Bettina|Axel|Maija|Vilma|Mauro|Mohamed|Danny|Marko|Edgar|Sergio|AnaJulia|Benicio|Heloisa|MariaJulia|Vinicius|Henriette|Mathilde|Sabine|Dylan|Sylvie|Knut|Harald|Ada|Aleksander|Dariusz|Elzbieta|Grzegorz|Jacek|Janina|Jerzy|Kornelia|Krystyna|Mariusz|Ryszard|Stanislaw|Sylwia",
  "Tadeusz|Urszula|Witold|Wojciech|Balint|Cecilie|Frode|Grethe|Kare|Line|Morten|Oystein|Oyvind|Randi|Silje|Stine|Trine|Beth|Sylvia|Miriam|Lise|Sander|Marian|Nikolett|Kyara|Yara|Levente|Kathryn|Cheryl|Laila|Jaime|Debra|Sonja|Reka|Noel|Wendy|Pirjo|Terezia|Marcin|Augusto|Fernanda|Matyas|Dagmar|Adrienn|Karolina|Karoliina|Anja|Paulina|Dina|Katja|Pauliina|Joan|Tiffany|Antal|Odette|Sari|Anouk|Frederique|Jules|Juliette|Luc|Olivier|Tore|Matteo|Irmeli|Adrianna|Aleks|Anastazja|Aniela|Antoni|Arkadiusz|Bartek|Blazej|Borys|Cezary|Cyprian|Dagmara|Dawid|Eryk|Ewelina|Franciszek|Fryderyk|Gaja|Gustaw|Ignacy|Iwo|Jedrzej|Jeremi|Julita|Juliusz|Justyna|Kacper|Kaja|Kajetan|Kalina|Karol|Kazimierz|Konstanty|Krystian|Ksawery",
  "Liwia|Lukasz|Maciej|Maks|Maksymilian|Malwina|Marcelina|Mateusz|Maurycy|Mieszko|Mikolaj|Milosz|Natan|Nataniel|Natasza|Nikodem|Olgierd|Oliwier|Patryk|Przemyslaw|Radoslaw|Rafal|Roksana|Szymon|Tobiasz|Tola|Tymon|Tymoteusz|Wiktor|Renato|Kristoffer|Ensio|Natasha|Dan|Tim|Gergely|Ari|Eeva|Romana|Jasmine|Jesper|Brigitta|Crystal|Lilla|Leslie|Sten|Pentti|Monique|Sanna|Angelica|Valtteri|Vivien|Levi|Antony|Akos|Harry|Lynn|Christer|Holly|Katarina|Enrico|Giovanna|Luigi|Pietro|Hakan|Melina|Siri|Tiina|Jay|Petter|Dante|Craig|Angelina|Frida|Sabina|Mattias|Janet|Pierre|Eniko|Eli|Phillip|Lori|Isa|Alvaro|Carlota|Debora|Fabiana|Flor|Francisca|Gaspar|Gil|Ismael|Leonor|Lisandro|Marcio|Marcos|Matilde|Nuria|Pilar|Salome",
  "Salvador|Santiago|Vasco|Violeta|Niklas|Sigurd|Felicia|Lea|Sabrina|Bernadett|Luke|Evelina|Tuomas|Rudolf|Colin|Zachary|Pirkko|Aron|Eveliina|Nancy|Elvira|Gunilla|Tarja|Rasmus|Derek|Abigail|Alma|Mohammed|Katie|Edina|Vidar|Mike|Carol|Olav|Antonella|Audrey|Dean|Hajnalka|Ingemar|Kent|Molly|Gabrielle|Juho|Tor|Gyongyi|Satu|Jimmy|Stacey|Eero|Micael|Yan|Ben|Chelsea|Judith|Josef|Liz|Ravi|Geza|Alexandria|Filippa|Martti|May|Hilde|Dag|Michaela|Irina|Lia|Kurt|Jordan|Erin|Johnny|Seija|Dominique|Francesca|Tanja|Carolyn|Michel|Ariana|Eila|Thor|Eugene|Boglarka|Orsolya|Gilbert|Jake|Agata|Alina|Shane|Jim|Evelyn|Birgit|Sirpa|Kate|Harri|Raija|Alyssa|Mohammad|Arpad|Virginia|Jerome"
].join("|");

export const COMMON_PERSON_NAMES = Object.freeze(NAME_DATA.split("|"));
const RESERVED_STAGE1_NAMES = new Set(["Mira", "Rowan", "Ilya", "Anya", "Tomas", "Lida", "Pavel", "Vera", "Niko", "Sonya", "Emil", "Daria", "Mark", "Nina", "Lev", "Zoya"].map((name) => name.toLowerCase()));
const GENERATED_PERSON_NAMES = COMMON_PERSON_NAMES.filter((name) => !RESERVED_STAGE1_NAMES.has(name.toLowerCase()));

export function generatedPopulationName(personId) {
  const id = String(personId ?? "");
  const seed = /^person-seed-(\d{3})$/.exec(id);
  if (seed) return GENERATED_PERSON_NAMES[(Math.max(1, Number(seed[1])) - 1) % GENERATED_PERSON_NAMES.length];
  return commonNameForKey(id || "generated-person");
}

export function commonNameForKey(key, excludedNames = []) {
  const excluded = new Set([...excludedNames].map((name) => String(name ?? "").toLowerCase()));
  const start = stableHash(String(key ?? "")) % COMMON_PERSON_NAMES.length;
  for (let offset = 0; offset < COMMON_PERSON_NAMES.length; offset += 1) {
    const name = COMMON_PERSON_NAMES[(start + offset * 131) % COMMON_PERSON_NAMES.length];
    if (!excluded.has(name.toLowerCase())) return name;
  }
  return COMMON_PERSON_NAMES[start];
}

export function isLegacyResidentName(value) {
  return /^Resident(?:\s|$)/i.test(String(value ?? "").trim());
}

function stableHash(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
