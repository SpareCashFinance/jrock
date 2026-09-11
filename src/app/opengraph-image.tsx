import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const mascot = await readFile(join(process.cwd(), "public/mascot.jpg"));
  const src = `data:image/jpeg;base64,${mascot.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "64px",
          background: "linear-gradient(135deg, #060A12 0%, #121820 55%, #1a1208 100%)",
          color: "#f7f4ee",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#d4b46a" }}>
            $JROCK · SOLANA · STONK.FUN
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 0.95, marginTop: 18 }}>
            JAMIE’S PET ROCK
          </div>
          <div style={{ fontSize: 36, color: "#f7931a", marginTop: 16 }}>
            The pet rock that pays in Bitcoin.
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={360} height={360} alt="" />
      </div>
    ),
    size,
  );
}
