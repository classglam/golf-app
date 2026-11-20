import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises = [
  {
    title: "Pump drill contra over-the-top",
    description:
      "Desde la cima del backswing, haz tres 'bombeos' cortos hacia abajo antes de completar el swing, bajando siempre el brazo por dentro antes de girar. Entrena la secuencia caderas-antes-que-brazos.",
    faultTags: ["over_the_top", "slice"],
    difficulty: "beginner",
  },
  {
    title: "Swing con la cabeza del palo hacia atrás (step drill)",
    description:
      "Coloca dos palos en el suelo formando un pasillo hacia el objetivo y practica bajar el palo dentro de ese pasillo en el downswing.",
    faultTags: ["over_the_top", "slice"],
    difficulty: "beginner",
  },
  {
    title: "Wall drill anti early extension",
    description:
      "Colócate en tu postura con los glúteos tocando una pared o silla y haz swings a medio volumen manteniendo el contacto de los glúteos durante todo el recorrido.",
    faultTags: ["early_extension"],
    difficulty: "beginner",
  },
  {
    title: "Chair drill para transferencia de peso",
    description:
      "Apoya una silla justo detrás de tu pie trasero. En el downswing, empuja activamente el peso hacia el pie delantero evitando golpear la silla con la cadera trasera.",
    faultTags: ["poor_weight_transfer"],
    difficulty: "intermediate",
  },
  {
    title: "Split-hand drill contra casting",
    description:
      "Agarra el palo separando ligeramente las manos en el grip y haz swings suaves sintiendo cómo se retrasa la liberación de la muñeca hasta el impacto.",
    faultTags: ["casting", "early_release"],
    difficulty: "intermediate",
  },
  {
    title: "Towel under the arms",
    description:
      "Coloca una toalla pequeña bajo ambas axilas y haz swings de tres cuartos sin que se caiga, para entrenar la conexión de los brazos con el giro del cuerpo.",
    faultTags: ["over_the_top", "poor_connection"],
    difficulty: "beginner",
  },
  {
    title: "Alineación con palos en el suelo",
    description:
      "Coloca un palo apuntando a la línea de los pies y otro perpendicular en la línea de la bola para comprobar alineación de hombros, caderas y pies antes de cada golpe.",
    faultTags: ["alignment"],
    difficulty: "beginner",
  },
  {
    title: "Slow-motion swing (50%)",
    description:
      "Realiza 10 swings completos a la mitad de la velocidad habitual, prestando atención a la secuencia: caderas, torso, brazos y palo.",
    faultTags: ["sequencing", "tempo"],
    difficulty: "beginner",
  },
  {
    title: "Drill de tempo 3:1",
    description:
      "Cuenta mentalmente '1-2-3' en el backswing y '1' en el downswing para interiorizar una relación de tempo 3:1, muy común en jugadores de élite.",
    faultTags: ["tempo"],
    difficulty: "intermediate",
  },
  {
    title: "Impact bag drill",
    description:
      "Golpea repetidamente un saco de impacto (o cojín firme) enfocándote en llegar con las manos por delante de la cabeza del palo y las caderas ya giradas hacia el objetivo.",
    faultTags: ["early_release", "impact_position"],
    difficulty: "intermediate",
  },
  {
    title: "One-arm drill (solo brazo guía)",
    description:
      "Haz swings cortos solo con el brazo guía (izquierdo en diestros) para sentir la extensión y el control de la cara del palo sin depender del otro brazo.",
    faultTags: ["poor_connection", "impact_position"],
    difficulty: "advanced",
  },
  {
    title: "Hip bump drill",
    description:
      "Desde arriba del backswing, inicia el downswing con un ligero desplazamiento lateral de cadera hacia el objetivo antes de girar, para mejorar la secuencia cinética.",
    faultTags: ["poor_weight_transfer", "sequencing"],
    difficulty: "intermediate",
  },
  {
    title: "Gate drill para el putt",
    description:
      "Coloca dos tees formando una puerta ligeramente más ancha que la cabeza del putter e intenta que el putter pase por el medio en cada golpe.",
    faultTags: ["putting_path"],
    difficulty: "beginner",
  },
  {
    title: "Ladder drill de distancias en approach",
    description:
      "Golpea bolas a distancias crecientes de 10 en 10 metros con el mismo palo, ajustando solo la longitud del swing, para mejorar el control de distancia.",
    faultTags: ["distance_control"],
    difficulty: "intermediate",
  },
  {
    title: "Feet together drill",
    description:
      "Golpea bolas con los pies juntos para forzar equilibrio y una secuencia de giro más compacta y centrada.",
    faultTags: ["balance", "poor_connection"],
    difficulty: "advanced",
  },
];

async function main() {
  // Idempotent so it can run on every deploy.
  const existing = await prisma.exercise.count();
  if (existing > 0) {
    console.log(`Seed omitido: ya hay ${existing} ejercicios.`);
    return;
  }
  for (const exercise of exercises) {
    await prisma.exercise.create({ data: exercise as any });
  }
  console.log(`Seed completo: ${exercises.length} ejercicios creados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
