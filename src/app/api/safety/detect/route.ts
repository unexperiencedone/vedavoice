// src/app/api/safety/detect/route.ts

export async function POST(req: Request) {
  const { frame } = await req.json()

  // --- YOUR FRIEND REPLACES EVERYTHING BELOW THIS LINE ---
  // They call their YOLO model here with the base64 frame
  // and return real detections in the same shape
  
  // STUB: returns mock detections for UI development
  const mockDetections = [
    {
      label: "helmet",
      confidence: 0.94,
      bbox: { x: 30, y: 15, width: 18, height: 22 }
    },
    {
      label: "toolbox",
      confidence: 0.88,
      bbox: { x: 55, y: 70, width: 25, height: 20 }
    }
  ]

  // Simulate minimal inference delay
  await new Promise(r => setTimeout(r, 600))

  return Response.json({
    detections: mockDetections,
    timestamp: new Date().toISOString()
  })
  // --- END STUB ---
}
