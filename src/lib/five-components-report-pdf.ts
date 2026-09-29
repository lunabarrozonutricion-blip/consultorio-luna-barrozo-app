export type FiveComponentsPdfMeasure = {
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  difference: number | null;
};

export type FiveComponentsPdfMass = {
  label: string;
  kg: number | null;
  percent: number | null;
  scoreZ: number | null;
  previousKg: number | null;
  differenceKg: number | null;
};

export type FiveComponentsPdfExtra = {
  label: string;
  value: string;
};

type FiveComponentsPdfInput = {
  playerName: string;
  date: string;
  source: string;

  previousDate?: string | null;

  weight: number | null;
  stature: number | null;
  sum6: number | null;
  muscleBoneIndex: number | null;

  previousSum6?: number | null;
  previousMuscleBoneIndex?: number | null;
  previousZAdipose?: number | null;

  measurements: FiveComponentsPdfMeasure[];
  masses: FiveComponentsPdfMass[];
  extras: FiveComponentsPdfExtra[];
};

type PdfResult = {
  blob: Blob;
  fileName: string;
};

type CardTone =
  | "blue"
  | "rose"
  | "amber"
  | "teal"
  | "indigo";

type FavorableDirection =
  | "increase"
  | "decrease";

const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 1754;

const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;

const PAGE_MARGIN = 72;

const COLORS = {
  navy: "#09244a",
  blue: "#2563eb",
  blueLight: "#eff6ff",
  blueBorder: "#bfdbfe",

  rose: "#be123c",
  roseLight: "#fff1f2",
  roseBorder: "#fecdd3",

  amber: "#92400e",
  amberLight: "#fffbeb",
  amberBorder: "#fde68a",

  teal: "#115e59",
  tealLight: "#f0fdfa",
  tealBorder: "#99f6e4",

  indigo: "#3730a3",
  indigoLight: "#eef2ff",
  indigoBorder: "#c7d2fe",

  green: "#047857",
  red: "#be123c",

  slate950: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
};

const TONES: Record<
  CardTone,
  {
    background: string;
    border: string;
    title: string;
  }
> = {
  blue: {
    background: COLORS.blueLight,
    border: COLORS.blueBorder,
    title: "#172554",
  },
  rose: {
    background: COLORS.roseLight,
    border: COLORS.roseBorder,
    title: "#4c0519",
  },
  amber: {
    background: COLORS.amberLight,
    border: COLORS.amberBorder,
    title: "#451a03",
  },
  teal: {
    background: COLORS.tealLight,
    border: COLORS.tealBorder,
    title: "#042f2e",
  },
  indigo: {
    background: COLORS.indigoLight,
    border: COLORS.indigoBorder,
    title: "#1e1b4b",
  },
};

function numberText(
  value:
    | number
    | null
    | undefined,
  decimals = 1,
) {
  if (value == null) {
    return "—";
  }

  return value
    .toFixed(decimals)
    .replace(".", ",");
}

function signedText(
  value:
    | number
    | null
    | undefined,
  decimals = 1,
) {
  if (value == null) {
    return "—";
  }

  const prefix =
    value > 0
      ? "+"
      : "";

  return `${prefix}${numberText(
    value,
    decimals,
  )}`;
}

function safeName(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-zA-Z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .toLowerCase();
}

function difference(
  current:
    | number
    | null
    | undefined,
  previous:
    | number
    | null
    | undefined,
) {
  if (
    current == null ||
    previous == null
  ) {
    return null;
  }

  const value =
    current - previous;

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function roundedRect(
  context:
    CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 18,
) {
  const r =
    Math.min(
      radius,
      width / 2,
      height / 2,
    );

  context.beginPath();
  context.moveTo(
    x + r,
    y,
  );
  context.lineTo(
    x + width - r,
    y,
  );
  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r,
  );
  context.lineTo(
    x + width,
    y + height - r,
  );
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  );
  context.lineTo(
    x + r,
    y + height,
  );
  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r,
  );
  context.lineTo(
    x,
    y + r,
  );
  context.quadraticCurveTo(
    x,
    y,
    x + r,
    y,
  );
  context.closePath();
}

function fillRoundedRect(
  context:
    CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
  lineWidth = 2,
) {
  roundedRect(
    context,
    x,
    y,
    width,
    height,
    radius,
  );

  context.fillStyle =
    fill;
  context.fill();

  if (stroke) {
    context.strokeStyle =
      stroke;
    context.lineWidth =
      lineWidth;
    context.stroke();
  }
}

function fitText(
  context:
    CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (
    context.measureText(
      text,
    ).width <=
    maxWidth
  ) {
    return text;
  }

  let result =
    text;

  while (
    result.length > 1 &&
    context.measureText(
      `${result}…`,
    ).width >
      maxWidth
  ) {
    result =
      result.slice(
        0,
        -1,
      );
  }

  return `${result}…`;
}

function drawText(
  context:
    CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    size,
    weight = 400,
    color =
      COLORS.slate950,
    align = "left",
  }: {
    size: number;
    weight?: number;
    color?: string;
    align?:
      | CanvasTextAlign;
  },
) {
  context.save();
  context.font =
    `${weight} ${size}px Arial, sans-serif`;
  context.fillStyle =
    color;
  context.textAlign =
    align;
  context.textBaseline =
    "alphabetic";
  context.fillText(
    text,
    x,
    y,
  );
  context.restore();
}

function drawRule(
  context:
    CanvasRenderingContext2D,
  y: number,
) {
  context.save();
  context.strokeStyle =
    COLORS.slate200;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(
    PAGE_MARGIN,
    y,
  );
  context.lineTo(
    CANVAS_WIDTH -
      PAGE_MARGIN,
    y,
  );
  context.stroke();
  context.restore();
}

async function loadLogo() {
  try {
    const response =
      await fetch(
        "/logo-san-lorenzo.png",
        {
          cache: "force-cache",
        },
      );

    if (!response.ok) {
      return null;
    }

    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(
        blob,
      );

    const image =
      new Image();

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        image.onload =
          () => resolve();

        image.onerror =
          () =>
            reject(
              new Error(
                "No se pudo cargar el logo.",
              ),
            );

        image.src =
          url;
      },
    );

    URL.revokeObjectURL(
      url,
    );

    return image;
  } catch {
    return null;
  }
}

function drawHeader(
  context:
    CanvasRenderingContext2D,
  input:
    FiveComponentsPdfInput,
  logo:
    HTMLImageElement | null,
  title: string,
  subtitle: string,
) {
  context.fillStyle =
    COLORS.white;
  context.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  context.fillStyle =
    COLORS.navy;
  context.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    18,
  );

  const logoSize =
    112;

  if (logo) {
    const ratio =
      Math.min(
        logoSize /
          logo.naturalWidth,
        logoSize /
          logo.naturalHeight,
      );

    const width =
      logo.naturalWidth *
      ratio;

    const height =
      logo.naturalHeight *
      ratio;

    context.drawImage(
      logo,
      PAGE_MARGIN +
        (logoSize -
          width) /
          2,
      52 +
        (logoSize -
          height) /
          2,
      width,
      height,
    );
  } else {
    fillRoundedRect(
      context,
      PAGE_MARGIN,
      52,
      logoSize,
      logoSize,
      20,
      COLORS.navy,
    );

    drawText(
      context,
      "CASLA",
      PAGE_MARGIN +
        logoSize / 2,
      120,
      {
        size: 26,
        weight: 700,
        color:
          COLORS.white,
        align: "center",
      },
    );
  }

  drawText(
    context,
    "SAN LORENZO · FÚTBOL FEMENINO",
    PAGE_MARGIN +
      logoSize +
      30,
    77,
    {
      size: 18,
      weight: 700,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    title,
    PAGE_MARGIN +
      logoSize +
      30,
    119,
    {
      size: 34,
      weight: 700,
      color:
        COLORS.slate950,
    },
  );

  drawText(
    context,
    subtitle,
    PAGE_MARGIN +
      logoSize +
      30,
    151,
    {
      size: 19,
      color:
        COLORS.slate500,
    },
  );

  drawRule(
    context,
    190,
  );

  drawText(
    context,
    input.playerName,
    PAGE_MARGIN,
    229,
    {
      size: 27,
      weight: 700,
    },
  );

  drawText(
    context,
    `Fecha: ${input.date}`,
    PAGE_MARGIN,
    263,
    {
      size: 18,
      color:
        COLORS.slate600,
    },
  );

  drawText(
    context,
    `Origen: ${input.source}`,
    CANVAS_WIDTH -
      PAGE_MARGIN,
    263,
    {
      size: 18,
      color:
        COLORS.slate500,
      align: "right",
    },
  );
}

function massByLabel(
  input:
    FiveComponentsPdfInput,
  label: string,
) {
  return (
    input.masses.find(
      (mass) =>
        mass.label ===
        label,
    ) ?? null
  );
}

function changeColor(
  value:
    | number
    | null,
  favorableDirection:
    FavorableDirection,
) {
  if (
    value == null ||
    value === 0
  ) {
    return COLORS.slate700;
  }

  const favorable =
    favorableDirection ===
    "increase"
      ? value > 0
      : value < 0;

  return favorable
    ? COLORS.green
    : COLORS.red;
}

function drawComparisonCard(
  context:
    CanvasRenderingContext2D,
  {
    x,
    y,
    width,
    height,
    label,
    previous,
    current,
    change,
    decimals,
    unit,
    tone,
    favorableDirection,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    previous:
      | number
      | null
      | undefined;
    current:
      | number
      | null
      | undefined;
    change:
      | number
      | null
      | undefined;
    decimals: number;
    unit: string;
    tone: CardTone;
    favorableDirection:
      FavorableDirection;
  },
) {
  const colors =
    TONES[tone];

  fillRoundedRect(
    context,
    x,
    y,
    width,
    height,
    20,
    colors.background,
    colors.border,
    2,
  );

  drawText(
    context,
    label,
    x + 24,
    y + 39,
    {
      size: 21,
      weight: 700,
      color:
        colors.title,
    },
  );

  const centers = [
    x + width *
      0.18,
    x + width *
      0.50,
    x + width *
      0.82,
  ];

  const labels = [
    "ANTERIOR",
    "ACTUAL",
    "CAMBIO",
  ];

  const values = [
    previous != null
      ? `${numberText(
          previous,
          decimals,
        )}${unit}`
      : "—",
    current != null
      ? `${numberText(
          current,
          decimals,
        )}${unit}`
      : "—",
    change != null
      ? `${signedText(
          change,
          decimals,
        )}${unit}`
      : "—",
  ];

  labels.forEach(
    (
      item,
      index,
    ) => {
      drawText(
        context,
        item,
        centers[index],
        y + 92,
        {
          size: 14,
          weight: 700,
          color:
            COLORS.slate500,
          align: "center",
        },
      );

      drawText(
        context,
        values[index],
        centers[index],
        y + 128,
        {
          size: 23,
          weight: 700,
          color:
            index === 2
              ? changeColor(
                  change ??
                    null,
                  favorableDirection,
                )
              : COLORS.slate950,
          align: "center",
        },
      );
    },
  );
}

function drawInfoChip(
  context:
    CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  fillRoundedRect(
    context,
    x,
    y,
    width,
    76,
    16,
    COLORS.slate50,
    COLORS.slate200,
    2,
  );

  drawText(
    context,
    label.toUpperCase(),
    x + 18,
    y + 27,
    {
      size: 13,
      weight: 700,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    value,
    x + 18,
    y + 58,
    {
      size: 22,
      weight: 700,
      color:
        COLORS.slate950,
    },
  );
}

function drawCompositionRow(
  context:
    CanvasRenderingContext2D,
  y: number,
  mass:
    FiveComponentsPdfMass,
  accent: string,
) {
  const left =
    PAGE_MARGIN;

  const width =
    CANVAS_WIDTH -
    PAGE_MARGIN * 2;

  fillRoundedRect(
    context,
    left,
    y,
    width,
    55,
    12,
    COLORS.white,
    COLORS.slate200,
    1.5,
  );

  context.fillStyle =
    accent;
  context.fillRect(
    left,
    y,
    8,
    55,
  );

  drawText(
    context,
    mass.label,
    left + 26,
    y + 35,
    {
      size: 18,
      weight: 700,
      color:
        COLORS.slate800,
    },
  );

  const columns = [
    {
      x: left + 610,
      value:
        mass.kg != null
          ? `${numberText(
              mass.kg,
              2,
            )} kg`
          : "—",
    },
    {
      x: left + 790,
      value:
        mass.percent !=
        null
          ? `${numberText(
              mass.percent,
              2,
            )}%`
          : "—",
    },
    {
      x: left + 980,
      value:
        mass.scoreZ !=
        null
          ? numberText(
              mass.scoreZ,
              2,
            )
          : "—",
    },
  ];

  columns.forEach(
    (column) =>
      drawText(
        context,
        column.value,
        column.x,
        y + 35,
        {
          size: 18,
          weight: 700,
          align:
            "center",
        },
      ),
  );
}

function buildSummaryCanvas(
  input:
    FiveComponentsPdfInput,
  logo:
    HTMLImageElement | null,
) {
  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    CANVAS_WIDTH;
  canvas.height =
    CANVAS_HEIGHT;

  const context =
    canvas.getContext(
      "2d",
    );

  if (!context) {
    throw new Error(
      "No se pudo crear el PDF.",
    );
  }

  drawHeader(
    context,
    input,
    logo,
    "Informe de Composición Corporal",
    "Fraccionamiento corporal de 5 componentes · Kerr",
  );

  const muscle =
    massByLabel(
      input,
      "Masa muscular",
    );

  const adipose =
    massByLabel(
      input,
      "Masa adiposa",
    );

  drawText(
    context,
    "Comparación con la evaluación anterior",
    PAGE_MARGIN,
    328,
    {
      size: 28,
      weight: 700,
    },
  );

  drawText(
    context,
    input.previousDate
      ? `${input.previousDate} → ${input.date}`
      : "Sin evaluación anterior",
    PAGE_MARGIN,
    360,
    {
      size: 18,
      color:
        COLORS.slate500,
    },
  );

  const cardGap =
    22;

  const cardWidth =
    (
      CANVAS_WIDTH -
      PAGE_MARGIN * 2 -
      cardGap
    ) /
    2;

  const cardHeight =
    157;

  drawComparisonCard(
    context,
    {
      x: PAGE_MARGIN,
      y: 391,
      width:
        cardWidth,
      height:
        cardHeight,
      label:
        "Masa muscular",
      previous:
        muscle?.previousKg ??
        null,
      current:
        muscle?.kg ??
        null,
      change:
        muscle?.differenceKg ??
        null,
      decimals: 3,
      unit: " kg",
      tone: "blue",
      favorableDirection:
        "increase",
    },
  );

  drawComparisonCard(
    context,
    {
      x:
        PAGE_MARGIN +
        cardWidth +
        cardGap,
      y: 391,
      width:
        cardWidth,
      height:
        cardHeight,
      label:
        "Masa adiposa",
      previous:
        adipose?.previousKg ??
        null,
      current:
        adipose?.kg ??
        null,
      change:
        adipose?.differenceKg ??
        null,
      decimals: 3,
      unit: " kg",
      tone: "rose",
      favorableDirection:
        "decrease",
    },
  );

  drawComparisonCard(
    context,
    {
      x: PAGE_MARGIN,
      y: 571,
      width:
        cardWidth,
      height:
        cardHeight,
      label:
        "Sumatoria de 6 pliegues",
      previous:
        input.previousSum6 ??
        null,
      current:
        input.sum6,
      change:
        difference(
          input.sum6,
          input.previousSum6,
        ),
      decimals: 1,
      unit: " mm",
      tone: "amber",
      favorableDirection:
        "decrease",
    },
  );

  drawComparisonCard(
    context,
    {
      x:
        PAGE_MARGIN +
        cardWidth +
        cardGap,
      y: 571,
      width:
        cardWidth,
      height:
        cardHeight,
      label:
        "IMO · Índice músculo/óseo",
      previous:
        input
          .previousMuscleBoneIndex ??
        null,
      current:
        input.muscleBoneIndex,
      change:
        difference(
          input.muscleBoneIndex,
          input
            .previousMuscleBoneIndex,
        ),
      decimals: 3,
      unit: "",
      tone: "teal",
      favorableDirection:
        "increase",
    },
  );

  drawComparisonCard(
    context,
    {
      x: PAGE_MARGIN,
      y: 751,
      width:
        cardWidth,
      height:
        cardHeight,
      label:
        "Z adiposo",
      previous:
        input.previousZAdipose ??
        null,
      current:
        adipose?.scoreZ ??
        null,
      change:
        difference(
          adipose?.scoreZ,
          input.previousZAdipose,
        ),
      decimals: 2,
      unit: "",
      tone: "indigo",
      favorableDirection:
        "decrease",
    },
  );

  drawText(
    context,
    "Resumen actual",
    PAGE_MARGIN,
    958,
    {
      size: 26,
      weight: 700,
    },
  );

  const chipGap =
    16;

  const chipWidth =
    (
      CANVAS_WIDTH -
      PAGE_MARGIN * 2 -
      chipGap * 3
    ) /
    4;

  drawInfoChip(
    context,
    PAGE_MARGIN,
    987,
    chipWidth,
    "Peso",
    input.weight !=
      null
      ? `${numberText(
          input.weight,
          1,
        )} kg`
      : "—",
  );

  drawInfoChip(
    context,
    PAGE_MARGIN +
      (chipWidth +
        chipGap),
    987,
    chipWidth,
    "Talla",
    input.stature !=
      null
      ? `${numberText(
          input.stature,
          1,
        )} cm`
      : "—",
  );

  drawInfoChip(
    context,
    PAGE_MARGIN +
      (chipWidth +
        chipGap) *
        2,
    987,
    chipWidth,
    "Sum6",
    input.sum6 !=
      null
      ? `${numberText(
          input.sum6,
          1,
        )} mm`
      : "—",
  );

  drawInfoChip(
    context,
    PAGE_MARGIN +
      (chipWidth +
        chipGap) *
        3,
    987,
    chipWidth,
    "IMO",
    input.muscleBoneIndex !=
      null
      ? numberText(
          input.muscleBoneIndex,
          3,
        )
      : "—",
  );

  drawText(
    context,
    "Composición corporal actual",
    PAGE_MARGIN,
    1118,
    {
      size: 26,
      weight: 700,
    },
  );

  drawText(
    context,
    "Componente",
    PAGE_MARGIN +
      26,
    1155,
    {
      size: 14,
      weight: 700,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    "KG",
    PAGE_MARGIN +
      610,
    1155,
    {
      size: 14,
      weight: 700,
      color:
        COLORS.slate500,
      align: "center",
    },
  );

  drawText(
    context,
    "%",
    PAGE_MARGIN +
      790,
    1155,
    {
      size: 14,
      weight: 700,
      color:
        COLORS.slate500,
      align: "center",
    },
  );

  drawText(
    context,
    "SCORE-Z",
    PAGE_MARGIN +
      980,
    1155,
    {
      size: 14,
      weight: 700,
      color:
        COLORS.slate500,
      align: "center",
    },
  );

  const rowColors = [
    "#8b5cf6",
    "#a63a72",
    "#f4d35e",
    "#8fd3c7",
    "#6a0572",
  ];

  input.masses.forEach(
    (
      mass,
      index,
    ) => {
      drawCompositionRow(
        context,
        1175 +
          index * 66,
        mass,
        rowColors[
          index %
            rowColors.length
        ],
      );
    },
  );

  drawText(
    context,
    "Los cambios se interpretan junto con el contexto deportivo, nutricional y clínico de cada jugadora.",
    PAGE_MARGIN,
    1544,
    {
      size: 15,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    "San Lorenzo · Fútbol Femenino",
    PAGE_MARGIN,
    1668,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    "Página 1 de 2",
    CANVAS_WIDTH -
      PAGE_MARGIN,
    1668,
    {
      size: 15,
      color:
        COLORS.slate500,
      align: "right",
    },
  );

  return canvas;
}

function drawTableHeader(
  context:
    CanvasRenderingContext2D,
  y: number,
) {
  const left =
    PAGE_MARGIN;

  const width =
    CANVAS_WIDTH -
    PAGE_MARGIN * 2;

  fillRoundedRect(
    context,
    left,
    y,
    width,
    48,
    12,
    COLORS.navy,
  );

  const columns = {
    label:
      left + 20,
    unit:
      left + 590,
    current:
      left + 760,
    previous:
      left + 920,
    difference:
      left + 1060,
  };

  drawText(
    context,
    "Medición",
    columns.label,
    y + 31,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.white,
    },
  );

  drawText(
    context,
    "Unidad",
    columns.unit,
    y + 31,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.white,
      align: "center",
    },
  );

  drawText(
    context,
    "Actual",
    columns.current,
    y + 31,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.white,
      align: "center",
    },
  );

  drawText(
    context,
    "Anterior",
    columns.previous,
    y + 31,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.white,
      align: "center",
    },
  );

  drawText(
    context,
    "Diferencia",
    columns.difference,
    y + 31,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.white,
      align: "center",
    },
  );
}

function buildMeasurementsCanvas(
  input:
    FiveComponentsPdfInput,
  logo:
    HTMLImageElement | null,
) {
  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    CANVAS_WIDTH;
  canvas.height =
    CANVAS_HEIGHT;

  const context =
    canvas.getContext(
      "2d",
    );

  if (!context) {
    throw new Error(
      "No se pudo crear el PDF.",
    );
  }

  drawHeader(
    context,
    input,
    logo,
    "Mediciones antropométricas",
    "Valor actual, evaluación anterior y diferencia",
  );

  const tableTop =
    316;

  drawTableHeader(
    context,
    tableTop,
  );

  const left =
    PAGE_MARGIN;

  const width =
    CANVAS_WIDTH -
    PAGE_MARGIN * 2;

  const rowHeight =
    51;

  input.measurements.forEach(
    (
      row,
      index,
    ) => {
      const y =
        tableTop +
        55 +
        index *
          rowHeight;

      if (
        index % 2 === 1
      ) {
        context.fillStyle =
          COLORS.slate50;

        context.fillRect(
          left,
          y,
          width,
          rowHeight,
        );
      }

      context.strokeStyle =
        COLORS.slate200;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(
        left,
        y +
          rowHeight,
      );
      context.lineTo(
        left + width,
        y +
          rowHeight,
      );
      context.stroke();

      context.font =
        "700 16px Arial, sans-serif";

      const label =
        fitText(
          context,
          row.label,
          470,
        );

      drawText(
        context,
        label,
        left + 20,
        y + 33,
        {
          size: 16,
          weight: 700,
          color:
            COLORS.slate800,
        },
      );

      drawText(
        context,
        row.unit,
        left + 590,
        y + 33,
        {
          size: 15,
          color:
            COLORS.slate500,
          align: "center",
        },
      );

      drawText(
        context,
        row.current != null
          ? numberText(
              row.current,
              2,
            )
          : "—",
        left + 760,
        y + 33,
        {
          size: 16,
          weight: 700,
          align: "center",
        },
      );

      drawText(
        context,
        row.previous != null
          ? numberText(
              row.previous,
              2,
            )
          : "—",
        left + 920,
        y + 33,
        {
          size: 16,
          color:
            COLORS.slate600,
          align: "center",
        },
      );

      const differenceColor =
        row.difference ==
          null ||
        row.difference ===
          0
          ? COLORS.slate700
          : row.difference >
              0
            ? COLORS.blue
            : COLORS.slate700;

      drawText(
        context,
        row.difference != null
          ? signedText(
              row.difference,
              2,
            )
          : "—",
        left + 1060,
        y + 33,
        {
          size: 16,
          weight: 700,
          color:
            differenceColor,
          align: "center",
        },
      );
    },
  );

  const footerY =
    1668;

  drawText(
    context,
    "San Lorenzo · Fútbol Femenino",
    PAGE_MARGIN,
    footerY,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    "Página 2 de 2",
    CANVAS_WIDTH -
      PAGE_MARGIN,
    footerY,
    {
      size: 15,
      color:
        COLORS.slate500,
      align: "right",
    },
  );

  return canvas;
}

function base64ToBytes(
  value: string,
) {
  const binary =
    atob(value);

  const bytes =
    new Uint8Array(
      binary.length,
    );

  for (
    let index = 0;
    index <
    binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index,
      );
  }

  return bytes;
}

function canvasToJpeg(
  canvas:
    HTMLCanvasElement,
) {
  const dataUrl =
    canvas.toDataURL(
      "image/jpeg",
      0.93,
    );

  const base64 =
    dataUrl.split(
      ",",
    )[1];

  return base64ToBytes(
    base64,
  );
}

function asciiBytes(
  value: string,
) {
  const bytes =
    new Uint8Array(
      value.length,
    );

  for (
    let index = 0;
    index <
    value.length;
    index += 1
  ) {
    bytes[index] =
      value.charCodeAt(
        index,
      ) & 255;
  }

  return bytes;
}

function concatBytes(
  parts:
    Uint8Array[],
) {
  const length =
    parts.reduce(
      (
        total,
        part,
      ) =>
        total +
        part.length,
      0,
    );

  const result =
    new Uint8Array(
      length,
    );

  let offset =
    0;

  parts.forEach(
    (part) => {
      result.set(
        part,
        offset,
      );

      offset +=
        part.length;
    },
  );

  return result;
}

function buildImagePdf(
  images:
    Uint8Array[],
) {
  /*
   * Estructura:
   * 1 = Catalog
   * 2 = Pages
   * Por página:
   * page, image, content
   */

  const pageObjectNumbers =
    images.map(
      (
        _,
        index,
      ) =>
        3 +
        index * 3,
    );

  const imageObjectNumbers =
    pageObjectNumbers.map(
      (value) =>
        value + 1,
    );

  const contentObjectNumbers =
    pageObjectNumbers.map(
      (value) =>
        value + 2,
    );

  const objectCount =
    2 +
    images.length * 3;

  const objectParts =
    new Map<
      number,
      Uint8Array
    >();

  objectParts.set(
    1,
    asciiBytes(
      "<< /Type /Catalog /Pages 2 0 R >>",
    ),
  );

  objectParts.set(
    2,
    asciiBytes(
      `<< /Type /Pages /Count ${images.length} /Kids [${pageObjectNumbers
        .map(
          (value) =>
            `${value} 0 R`,
        )
        .join(" ")}] >>`,
    ),
  );

  images.forEach(
    (
      imageBytes,
      index,
    ) => {
      const pageObject =
        pageObjectNumbers[
          index
        ];

      const imageObject =
        imageObjectNumbers[
          index
        ];

      const contentObject =
        contentObjectNumbers[
          index
        ];

      objectParts.set(
        pageObject,
        asciiBytes(
          [
            "<<",
            "/Type /Page",
            "/Parent 2 0 R",
            `/MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}]`,
            `/Resources << /XObject << /Im${index + 1} ${imageObject} 0 R >> >>`,
            `/Contents ${contentObject} 0 R`,
            ">>",
          ].join(
            "\n",
          ),
        ),
      );

      const imageHeader =
        asciiBytes(
          [
            "<<",
            "/Type /XObject",
            "/Subtype /Image",
            `/Width ${CANVAS_WIDTH}`,
            `/Height ${CANVAS_HEIGHT}`,
            "/ColorSpace /DeviceRGB",
            "/BitsPerComponent 8",
            "/Filter /DCTDecode",
            `/Length ${imageBytes.length}`,
            ">>",
            "stream",
            "",
          ].join(
            "\n",
          ),
        );

      const imageFooter =
        asciiBytes(
          "\nendstream",
        );

      objectParts.set(
        imageObject,
        concatBytes([
          imageHeader,
          imageBytes,
          imageFooter,
        ]),
      );

      const content =
        `q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/Im${index + 1} Do\nQ\n`;

      const contentBytes =
        asciiBytes(
          content,
        );

      objectParts.set(
        contentObject,
        concatBytes([
          asciiBytes(
            `<< /Length ${contentBytes.length} >>\nstream\n`,
          ),
          contentBytes,
          asciiBytes(
            "endstream",
          ),
        ]),
      );
    },
  );

  const chunks:
    Uint8Array[] = [];

  const offsets =
    new Array<number>(
      objectCount + 1,
    ).fill(0);

  const header =
    asciiBytes(
      "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n",
    );

  chunks.push(
    header,
  );

  let offset =
    header.length;

  for (
    let objectNumber = 1;
    objectNumber <=
    objectCount;
    objectNumber += 1
  ) {
    offsets[
      objectNumber
    ] =
      offset;

    const prefix =
      asciiBytes(
        `${objectNumber} 0 obj\n`,
      );

    const body =
      objectParts.get(
        objectNumber,
      ) ??
      asciiBytes(
        "<<>>",
      );

    const suffix =
      asciiBytes(
        "\nendobj\n",
      );

    chunks.push(
      prefix,
      body,
      suffix,
    );

    offset +=
      prefix.length +
      body.length +
      suffix.length;
  }

  const xrefOffset =
    offset;

  let xref =
    `xref\n0 ${objectCount + 1}\n`;

  xref +=
    "0000000000 65535 f \n";

  for (
    let objectNumber = 1;
    objectNumber <=
    objectCount;
    objectNumber += 1
  ) {
    xref += `${String(
      offsets[
        objectNumber
      ],
    ).padStart(
      10,
      "0",
    )} 00000 n \n`;
  }

  const trailer =
    [
      "trailer",
      `<< /Size ${objectCount + 1} /Root 1 0 R >>`,
      "startxref",
      String(
        xrefOffset,
      ),
      "%%EOF",
      "",
    ].join(
      "\n",
    );

  chunks.push(
    asciiBytes(
      xref,
    ),
    asciiBytes(
      trailer,
    ),
  );

  return concatBytes(
    chunks,
  );
}

export async function createFiveComponentsReportPdf(
  input:
    FiveComponentsPdfInput,
): Promise<PdfResult> {
  const logo =
    await loadLogo();

  const summaryCanvas =
    buildSummaryCanvas(
      input,
      logo,
    );

  const measurementsCanvas =
    buildMeasurementsCanvas(
      input,
      logo,
    );

  const bytes =
    buildImagePdf([
      canvasToJpeg(
        summaryCanvas,
      ),
      canvasToJpeg(
        measurementsCanvas,
      ),
    ]);

  return {
    blob: new Blob(
      [bytes],
      {
        type:
          "application/pdf",
      },
    ),

    fileName: `5-componentes-${safeName(
      input.playerName,
    )}-${input.date}.pdf`,
  };
}
