import type { Celebrity } from "../types/celebrity";

const commonsSource = (fileName: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replaceAll("%20", "_")}`;

export const celebrities: Celebrity[] = [
  {
    id: "barack-obama",
    name: "Barack Obama",
    aliases: ["Obama", "President Obama"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg",
    imageCredit: "Official White House photo by Pete Souza",
    sourceUrl: commonsSource("President Barack Obama.jpg"),
  },
  {
    id: "taylor-swift",
    name: "Taylor Swift",
    aliases: ["Taylor Alison Swift"],
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/b/b1/Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png",
    imageCredit: "MTV International, via Wikimedia Commons",
    sourceUrl: commonsSource("Taylor Swift at the 2023 MTV Video Music Awards (3).png"),
  },
  {
    id: "beyonce",
    name: "Beyonce",
    aliases: ["Beyonce Knowles", "Beyonce Knowles-Carter", "Beyoncé"],
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/1/17/Beyonc%C3%A9_at_The_Lion_King_European_Premiere_2019.png",
    imageCredit: "Raph_PH, via Wikimedia Commons",
    sourceUrl: commonsSource("Beyoncé at The Lion King European Premiere 2019.png"),
  },
  {
    id: "dwayne-johnson",
    name: "Dwayne Johnson",
    aliases: ["The Rock", "Dwayne The Rock Johnson"],
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/6/6f/Dwayne_Johnson_Hercules_2014_%28cropped%29.jpg",
    imageCredit: "Eva Rinaldi, via Wikimedia Commons",
    sourceUrl: commonsSource("Dwayne Johnson Hercules 2014 (cropped).jpg"),
  },
  {
    id: "zendaya",
    name: "Zendaya",
    aliases: ["Zendaya Coleman"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0c/Zendaya_2019_by_Glenn_Francis.jpg",
    imageCredit: "Glenn Francis, via Wikimedia Commons",
    sourceUrl: commonsSource("Zendaya 2019 by Glenn Francis.jpg"),
  },
  {
    id: "leonardo-dicaprio",
    name: "Leonardo DiCaprio",
    aliases: ["Leo DiCaprio", "Leonardo Wilhelm DiCaprio"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/25/Leonardo_DiCaprio_2014.jpg",
    imageCredit: "Siebbi, via Wikimedia Commons",
    sourceUrl: commonsSource("Leonardo DiCaprio 2014.jpg"),
  },
  {
    id: "oprah-winfrey",
    name: "Oprah Winfrey",
    aliases: ["Oprah"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Oprah_Winfrey_October_2014.jpg",
    imageCredit: "aphrodite-in-nyc, via Wikimedia Commons",
    sourceUrl: commonsSource("Oprah Winfrey October 2014.jpg"),
  },
  {
    id: "rihanna",
    name: "Rihanna",
    aliases: ["Robyn Rihanna Fenty"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Rihanna_Fenty_2018_2.png",
    imageCredit: "SIGMA, via Wikimedia Commons",
    sourceUrl: commonsSource("Rihanna Fenty 2018 2.png"),
  },
  {
    id: "tom-cruise",
    name: "Tom Cruise",
    aliases: ["Thomas Cruise Mapother"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/33/Tom_Cruise_by_Gage_Skidmore_2.jpg",
    imageCredit: "Gage Skidmore, via Wikimedia Commons",
    sourceUrl: commonsSource("Tom Cruise by Gage Skidmore 2.jpg"),
  },
  {
    id: "emma-watson",
    name: "Emma Watson",
    aliases: ["Emma Charlotte Duerre Watson"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Emma_Watson_2013.jpg",
    imageCredit: "Georges Biard, via Wikimedia Commons",
    sourceUrl: commonsSource("Emma Watson 2013.jpg"),
  },
  {
    id: "will-smith",
    name: "Will Smith",
    aliases: ["William Smith", "The Fresh Prince"],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/67/Will_Smith_by_Gage_Skidmore_2.jpg",
    imageCredit: "Gage Skidmore, via Wikimedia Commons",
    sourceUrl: commonsSource("Will Smith by Gage Skidmore 2.jpg"),
  },
  {
    id: "ariana-grande",
    name: "Ariana Grande",
    aliases: ["Ariana Grande-Butera"],
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/7/7c/Ariana_Grande_promoting_Wicked_%282024%29.jpg",
    imageCredit: "Universal Pictures, via Wikimedia Commons",
    sourceUrl: commonsSource("Ariana Grande promoting Wicked (2024).jpg"),
  },
];
