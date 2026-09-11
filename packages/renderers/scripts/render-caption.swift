import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 7,
      let width = Int(CommandLine.arguments[2]),
      let height = Int(CommandLine.arguments[3]),
      let fontSize = Double(CommandLine.arguments[5]),
      let position = Double(CommandLine.arguments[6]) else {
  fputs("usage: render-caption.swift <output.png> <width> <height> <text> <font-size> <position>\n", stderr)
  exit(2)
}

let output = CommandLine.arguments[1]
let text = CommandLine.arguments[4]
guard width > 0, height > 0, fontSize > 0, position >= 0, position <= 1 else {
  fputs("invalid caption dimensions or placement\n", stderr)
  exit(2)
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
  data: nil,
  width: width,
  height: height,
  bitsPerComponent: 8,
  bytesPerRow: width * 4,
  space: colorSpace,
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fputs("could not allocate caption bitmap\n", stderr)
  exit(1)
}

context.clear(CGRect(x: 0, y: 0, width: width, height: height))
context.textMatrix = .identity
context.setShadow(offset: CGSize(width: 0, height: -max(2, fontSize * 0.05)), blur: max(2, fontSize * 0.10), color: CGColor(gray: 0, alpha: 0.9))

let font = CTFontCreateWithName("Helvetica-Bold" as CFString, fontSize, nil)
let attributes: [CFString: Any] = [
  kCTFontAttributeName: font,
  kCTForegroundColorAttributeName: CGColor(gray: 1, alpha: 1),
  kCTStrokeColorAttributeName: CGColor(gray: 0, alpha: 0.95),
  kCTStrokeWidthAttributeName: -5.0
]
let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
let lineHeight = fontSize * 1.18
let blockHeight = lineHeight * Double(lines.count)
let centerFromBottom = Double(height) * (1 - position)
let firstBaseline = centerFromBottom + blockHeight / 2 - fontSize

for (index, value) in lines.enumerated() {
  let attributed = CFAttributedStringCreate(nil, value as CFString, attributes as CFDictionary)!
  let line = CTLineCreateWithAttributedString(attributed)
  let lineWidth = CTLineGetTypographicBounds(line, nil, nil, nil)
  context.textPosition = CGPoint(x: (Double(width) - lineWidth) / 2, y: firstBaseline - Double(index) * lineHeight)
  CTLineDraw(line, context)
}

guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: output) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fputs("could not create caption PNG destination\n", stderr)
  exit(1)
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
  fputs("could not encode caption PNG\n", stderr)
  exit(1)
}
