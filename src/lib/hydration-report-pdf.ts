import { fmtDate } from "./calc";

export type HydrationPdfMode =
  | "values"
  | "both"
  | "chart";

export type HydrationPdfEntry = {
  playerName: string;
  value: number | null;
  observation: string | null;
};

type HydrationPdfInput = {
  date: string;
  rival: string | null;
  round: number | null;
  dayType: string;
  context: string;
  entries: HydrationPdfEntry[];
  mode: HydrationPdfMode;
};

type PdfResult = {
  blob: Blob;
  fileName: string;
};

const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 1754;

const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;

const LEFT = 44;
const RIGHT = 44;

const COLORS = {
  navy: "#0b234a",
  white: "#ffffff",
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
  green: "#10b981",
  greenDark: "#047857",
  greenLight: "#d1fae5",
  rose: "#f43f5e",
  roseDark: "#be123c",
  roseLight: "#ffe4e6",
};

function safeDate(
  date: string,
) {
  return (
    date
      .replace(
        /[^0-9-]/g,
        "",
      ) ||
    "sin-fecha"
  );
}

function hydrationStatus(
  value: number | null,
) {
  if (value == null) {
    return "Sin dato";
  }

  return value <= 1020
    ? "Bien hidratada"
    : "Deshidratada";
}

function summaryFor(
  entries:
    HydrationPdfEntry[],
) {
  let hydrated = 0;
  let dehydrated = 0;
  let noData = 0;

  for (
    const entry of entries
  ) {
    if (
      entry.value == null
    ) {
      noData += 1;
    } else if (
      entry.value <= 1020
    ) {
      hydrated += 1;
    } else {
      dehydrated += 1;
    }
  }

  const measured =
    hydrated +
    dehydrated;

  return {
    hydrated,
    dehydrated,
    noData,
    measured,

    hydratedPercent:
      measured > 0
        ? (hydrated /
            measured) *
          100
        : 0,

    dehydratedPercent:
      measured > 0
        ? (dehydrated /
            measured) *
          100
        : 0,
  };
}

function roundedRect(
  context:
    CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 14,
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
      CanvasTextAlign;
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

function loadLogoFromPage() {
  const images =
    Array.from(
      document.images,
    );

  const logo =
    images.find(
      (image) =>
        image.src.includes(
          "logo-san-lorenzo.png",
        ) &&
        image.complete &&
        image.naturalWidth >
          0,
    );

  return logo ?? null;
}

function drawLogo(
  context:
    CanvasRenderingContext2D,
  logo:
    HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
) {
  if (!logo) {
    fillRoundedRect(
      context,
      x,
      y,
      size,
      size,
      12,
      COLORS.navy,
    );

    drawText(
      context,
      "CASLA",
      x +
        size / 2,
      y +
        size * 0.58,
      {
        size: 18,
        weight: 700,
        color:
          COLORS.white,
        align: "center",
      },
    );

    return;
  }

  const ratio =
    Math.min(
      size /
        logo.naturalWidth,
      size /
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
    x +
      (size -
        width) /
        2,
    y +
      (size -
        height) /
        2,
    width,
    height,
  );
}

function drawHeader(
  context:
    CanvasRenderingContext2D,
  input:
    HydrationPdfInput,
  logo:
    HTMLImageElement | null,
) {
  fillRoundedRect(
    context,
    LEFT,
    38,
    CANVAS_WIDTH -
      LEFT -
      RIGHT,
    196,
    14,
    COLORS.slate50,
    COLORS.slate300,
    2,
  );

  drawLogo(
    context,
    logo,
    LEFT + 18,
    58,
    72,
  );

  drawText(
    context,
    "SAN LORENZO · FÚTBOL FEMENINO",
    LEFT + 108,
    77,
    {
      size: 14,
      weight: 700,
      color:
        COLORS.slate500,
    },
  );

  drawText(
    context,
    "TEST DE HIDRATACIÓN",
    LEFT + 108,
    118,
    {
      size: 34,
      weight: 800,
      color:
        COLORS.slate950,
    },
  );

  const metaTop =
    160;

  const col1 =
    LEFT + 20;

  const col2 =
    LEFT + 420;

  const col3 =
    LEFT + 855;

  drawText(
    context,
    `Fecha: ${fmtDate(
      input.date,
    )}`,
    col1,
    metaTop,
    {
      size: 16,
      weight: 700,
    },
  );

  drawText(
    context,
    `Rival: ${
      input.rival?.trim() ||
      "—"
    }`,
    col2,
    metaTop,
    {
      size: 16,
      weight: 700,
    },
  );

  drawText(
    context,
    `N.º de fecha: ${
      input.round ?? "—"
    }`,
    col3,
    metaTop,
    {
      size: 16,
      weight: 700,
    },
  );

  drawText(
    context,
    `Tipo de día: ${input.dayType}`,
    col1,
    metaTop + 37,
    {
      size: 15,
      color:
        COLORS.slate700,
    },
  );

  drawText(
    context,
    `Contexto: ${input.context}`,
    col2,
    metaTop + 37,
    {
      size: 15,
      color:
        COLORS.slate700,
    },
  );
}

function drawTable(
  context:
    CanvasRenderingContext2D,
  input:
    HydrationPdfInput,
  startY: number,
) {
  const summary =
    summaryFor(
      input.entries,
    );

  drawText(
    context,
    "Valores",
    LEFT,
    startY,
    {
      size: 24,
      weight: 800,
    },
  );

  drawText(
    context,
    `${summary.measured} mediciones · ${summary.noData} sin valor`,
    CANVAS_WIDTH -
      RIGHT,
    startY,
    {
      size: 14,
      weight: 700,
      color:
        COLORS.slate500,
      align: "right",
    },
  );

  const tableTop =
    startY + 24;

  const tableWidth =
    CANVAS_WIDTH -
    LEFT -
    RIGHT;

  const headerHeight =
    34;

  const rowHeight =
    31;

  const nameWidth =
    300;

  const valueWidth =
    150;

  const stateWidth =
    250;

  const observationWidth =
    tableWidth -
    nameWidth -
    valueWidth -
    stateWidth;

  context.fillStyle =
    COLORS.navy;

  context.fillRect(
    LEFT,
    tableTop,
    tableWidth,
    headerHeight,
  );

  const columnX = [
    LEFT,
    LEFT +
      nameWidth,
    LEFT +
      nameWidth +
      valueWidth,
    LEFT +
      nameWidth +
      valueWidth +
      stateWidth,
  ];

  const headers = [
    {
      text: "Jugadora",
      x:
        columnX[0] +
        12,
    },
    {
      text: "Valor",
      x:
        columnX[1] +
        valueWidth /
          2,
      align:
        "center" as const,
    },
    {
      text: "Estado",
      x:
        columnX[2] +
        stateWidth /
          2,
      align:
        "center" as const,
    },
    {
      text:
        "Observación",
      x:
        columnX[3] +
        12,
    },
  ];

  headers.forEach(
    (header) =>
      drawText(
        context,
        header.text,
        header.x,
        tableTop + 23,
        {
          size: 14,
          weight: 700,
          color:
            COLORS.white,
          align:
            header.align ??
            "left",
        },
      ),
  );

  input.entries.forEach(
    (
      entry,
      index,
    ) => {
      const y =
        tableTop +
        headerHeight +
        index *
          rowHeight;

      context.fillStyle =
        index % 2 === 0
          ? COLORS.white
          : COLORS.slate50;

      context.fillRect(
        LEFT,
        y,
        tableWidth,
        rowHeight,
      );

      const status =
        hydrationStatus(
          entry.value,
        );

      if (
        entry.value != null
      ) {
        context.fillStyle =
          entry.value <=
          1020
            ? COLORS.greenLight
            : COLORS.roseLight;

        context.fillRect(
          columnX[2],
          y,
          stateWidth,
          rowHeight,
        );
      }

      context.strokeStyle =
        COLORS.slate300;

      context.lineWidth =
        1;

      context.beginPath();

      for (
        let i = 0;
        i <
        columnX.length;
        i += 1
      ) {
        context.moveTo(
          columnX[i],
          y,
        );

        context.lineTo(
          columnX[i],
          y +
            rowHeight,
        );
      }

      context.moveTo(
        LEFT +
          tableWidth,
        y,
      );

      context.lineTo(
        LEFT +
          tableWidth,
        y +
          rowHeight,
      );

      context.moveTo(
        LEFT,
        y +
          rowHeight,
      );

      context.lineTo(
        LEFT +
          tableWidth,
        y +
          rowHeight,
      );

      context.stroke();

      context.font =
        "700 13px Arial, sans-serif";

      drawText(
        context,
        fitText(
          context,
          entry.playerName,
          nameWidth -
            22,
        ),
        LEFT + 12,
        y + 21,
        {
          size: 13,
          weight: 700,
        },
      );

      drawText(
        context,
        entry.value !=
          null
          ? String(
              entry.value,
            )
          : "—",
        columnX[1] +
          valueWidth / 2,
        y + 21,
        {
          size: 13,
          color:
            COLORS.slate700,
          align: "center",
        },
      );

      drawText(
        context,
        status,
        columnX[2] +
          stateWidth / 2,
        y + 21,
        {
          size: 13,
          weight: 700,
          color:
            entry.value ==
            null
              ? COLORS.slate600
              : entry.value <=
                  1020
                ? COLORS.greenDark
                : COLORS.roseDark,
          align: "center",
        },
      );

      context.font =
        "400 13px Arial, sans-serif";

      drawText(
        context,
        fitText(
          context,
          entry.observation ??
            "—",
          observationWidth -
            22,
        ),
        columnX[3] +
          12,
        y + 21,
        {
          size: 13,
          color:
            COLORS.slate700,
        },
      );
    },
  );

  context.strokeStyle =
    COLORS.slate300;

  context.lineWidth =
    1;

  context.strokeRect(
    LEFT,
    tableTop,
    tableWidth,
    headerHeight +
      input.entries.length *
        rowHeight,
  );

  return (
    tableTop +
    headerHeight +
    input.entries.length *
      rowHeight
  );
}

function drawSummary(
  context:
    CanvasRenderingContext2D,
  input:
    HydrationPdfInput,
  startY: number,
) {
  const summary =
    summaryFor(
      input.entries,
    );

  const width =
    CANVAS_WIDTH -
    LEFT -
    RIGHT;

  drawText(
    context,
    "Estado de hidratación",
    LEFT,
    startY,
    {
      size: 24,
      weight: 800,
    },
  );

  drawText(
    context,
    "Porcentajes calculados solo sobre las jugadoras con medición.",
    LEFT,
    startY + 27,
    {
      size: 13,
      color:
        COLORS.slate500,
    },
  );

  const barX =
    LEFT;

  const barWidth =
    width;

  const barHeight =
    28;

  const labelGap =
    52;

  const firstY =
    startY + 72;

  const secondY =
    firstY + 86;

  drawText(
    context,
    "Bien hidratadas",
    barX,
    firstY,
    {
      size: 15,
      weight: 700,
    },
  );

  drawText(
    context,
    `${summary.hydratedPercent.toFixed(
      1,
    )}% · ${summary.hydrated} de ${summary.measured}`,
    barX +
      barWidth,
    firstY,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.greenDark,
      align: "right",
    },
  );

  fillRoundedRect(
    context,
    barX,
    firstY + 12,
    barWidth,
    barHeight,
    9,
    COLORS.slate100,
    COLORS.green,
    2,
  );

  if (
    summary.hydratedPercent >
    0
  ) {
    fillRoundedRect(
      context,
      barX,
      firstY + 12,
      Math.max(
        18,
        barWidth *
          (summary.hydratedPercent /
            100),
      ),
      barHeight,
      9,
      COLORS.green,
    );
  }

  if (
    summary.hydratedPercent >=
    12
  ) {
    drawText(
      context,
      `${summary.hydratedPercent.toFixed(
        1,
      )}%`,
      barX +
        barWidth *
          (summary.hydratedPercent /
            100) /
          2,
      firstY + 32,
      {
        size: 13,
        weight: 800,
        color:
          COLORS.white,
        align: "center",
      },
    );
  }

  drawText(
    context,
    "Deshidratadas",
    barX,
    secondY,
    {
      size: 15,
      weight: 700,
    },
  );

  drawText(
    context,
    `${summary.dehydratedPercent.toFixed(
      1,
    )}% · ${summary.dehydrated} de ${summary.measured}`,
    barX +
      barWidth,
    secondY,
    {
      size: 15,
      weight: 700,
      color:
        COLORS.roseDark,
      align: "right",
    },
  );

  fillRoundedRect(
    context,
    barX,
    secondY + 12,
    barWidth,
    barHeight,
    9,
    COLORS.slate100,
    COLORS.rose,
    2,
  );

  if (
    summary.dehydratedPercent >
    0
  ) {
    fillRoundedRect(
      context,
      barX,
      secondY + 12,
      Math.max(
        18,
        barWidth *
          (summary.dehydratedPercent /
            100),
      ),
      barHeight,
      9,
      COLORS.rose,
    );
  }

  if (
    summary.dehydratedPercent >=
    12
  ) {
    drawText(
      context,
      `${summary.dehydratedPercent.toFixed(
        1,
      )}%`,
      barX +
        barWidth *
          (summary.dehydratedPercent /
            100) /
          2,
      secondY + 32,
      {
        size: 13,
        weight: 800,
        color:
          COLORS.white,
        align: "center",
      },
    );
  }

  const cardsY =
    secondY + 74;

  const gap = 18;

  const cardWidth =
    (
      width -
      gap * 2
    ) /
    3;

  const cards = [
    {
      label:
        "Bien hidratadas",
      value:
        summary.hydrated,
      fill:
        COLORS.greenLight,
      border:
        "#a7f3d0",
      color:
        COLORS.greenDark,
    },
    {
      label:
        "Deshidratadas",
      value:
        summary.dehydrated,
      fill:
        COLORS.roseLight,
      border:
        "#fecdd3",
      color:
        COLORS.roseDark,
    },
    {
      label:
        "Sin medición",
      value:
        summary.noData,
      fill:
        COLORS.slate50,
      border:
        COLORS.slate300,
      color:
        COLORS.slate700,
    },
  ];

  cards.forEach(
    (
      card,
      index,
    ) => {
      const x =
        LEFT +
        index *
          (cardWidth +
            gap);

      fillRoundedRect(
        context,
        x,
        cardsY,
        cardWidth,
        78,
        12,
        card.fill,
        card.border,
        2,
      );

      drawText(
        context,
        String(
          card.value,
        ),
        x +
          cardWidth / 2,
        cardsY + 35,
        {
          size: 27,
          weight: 800,
          color:
            card.color,
          align:
            "center",
        },
      );

      drawText(
        context,
        card.label,
        x +
          cardWidth / 2,
        cardsY + 61,
        {
          size: 13,
          weight: 700,
          color:
            card.color,
          align:
            "center",
        },
      );
    },
  );
}

function buildCanvas(
  input:
    HydrationPdfInput,
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

  context.fillStyle =
    COLORS.white;

  context.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  drawHeader(
    context,
    input,
    logo,
  );

  let bottom =
    265;

  if (
    input.mode ===
      "values" ||
    input.mode ===
      "both"
  ) {
    bottom =
      drawTable(
        context,
        input,
        278,
      );
  }

  if (
    input.mode ===
      "chart" ||
    input.mode ===
      "both"
  ) {
    drawSummary(
      context,
      input,
      input.mode ===
        "both"
        ? bottom + 42
        : 330,
    );
  }

  drawText(
    context,
    "San Lorenzo · Fútbol Femenino",
    LEFT,
    CANVAS_HEIGHT - 38,
    {
      size: 12,
      weight: 700,
      color:
        COLORS.slate500,
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
      0.94,
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

  let offset = 0;

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
  imageBytes:
    Uint8Array,
) {
  const objects =
    new Map<
      number,
      Uint8Array
    >();

  objects.set(
    1,
    asciiBytes(
      "<< /Type /Catalog /Pages 2 0 R >>",
    ),
  );

  objects.set(
    2,
    asciiBytes(
      "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    ),
  );

  objects.set(
    3,
    asciiBytes(
      [
        "<<",
        "/Type /Page",
        "/Parent 2 0 R",
        `/MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}]`,
        "/Resources << /XObject << /Im1 4 0 R >> >>",
        "/Contents 5 0 R",
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

  objects.set(
    4,
    concatBytes([
      imageHeader,
      imageBytes,
      asciiBytes(
        "\nendstream",
      ),
    ]),
  );

  const content =
    `q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/Im1 Do\nQ\n`;

  const contentBytes =
    asciiBytes(
      content,
    );

  objects.set(
    5,
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

  const chunks:
    Uint8Array[] = [];

  const offsets =
    new Array<number>(
      6,
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
    objectNumber <= 5;
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
      objects.get(
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
    "xref\n0 6\n";

  xref +=
    "0000000000 65535 f \n";

  for (
    let objectNumber = 1;
    objectNumber <= 5;
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
      "<< /Size 6 /Root 1 0 R >>",
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

export function createHydrationReportPdf(
  input:
    HydrationPdfInput,
): PdfResult {
  const logo =
    loadLogoFromPage();

  const canvas =
    buildCanvas(
      input,
      logo,
    );

  const bytes =
    buildImagePdf(
      canvasToJpeg(
        canvas,
      ),
    );

  return {
    blob: new Blob(
      [bytes],
      {
        type:
          "application/pdf",
      },
    ),

    fileName: `test-hidratacion-${safeDate(
      input.date,
    )}.pdf`,
  };
}
