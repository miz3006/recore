// Render a local HTML file to a PNG at an exact pixel size, via WebKit.
// Chrome's headless mode is sandboxed off in this environment; WKWebView is not.
// usage: swift shot.swift <in.html> <out.png> <width> <height>
import AppKit
import WebKit

let args = CommandLine.arguments
guard args.count == 5,
      let w = Double(args[3]), let h = Double(args[4]) else {
    FileHandle.standardError.write("usage: shot.swift <in.html> <out.png> <w> <h>\n".data(using: .utf8)!)
    exit(2)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

final class Shooter: NSObject, WKNavigationDelegate {
    let web: WKWebView
    let out: URL
    let size: NSSize

    init(size: NSSize, out: URL) {
        self.size = size
        self.out = out
        let cfg = WKWebViewConfiguration()
        self.web = WKWebView(frame: NSRect(origin: .zero, size: size), configuration: cfg)
        super.init()
        web.navigationDelegate = self
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = .clear }
    }

    func load(_ url: URL) {
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
        // Give web fonts, SVG filters and layout a beat to settle.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { self.snap() }
    }

    func webView(_ wv: WKWebView, didFail nav: WKNavigation!, withError e: Error) { fail(e) }
    func webView(_ wv: WKWebView, didFailProvisionalNavigation nav: WKNavigation!, withError e: Error) { fail(e) }

    func fail(_ e: Error) {
        FileHandle.standardError.write("load failed: \(e)\n".data(using: .utf8)!)
        exit(1)
    }

    func snap() {
        let cfg = WKSnapshotConfiguration()
        cfg.rect = NSRect(origin: .zero, size: size)
        cfg.snapshotWidth = NSNumber(value: size.width) // 1 CSS px -> 1 image px
        web.takeSnapshot(with: cfg) { image, err in
            guard let image, err == nil else { self.fail(err ?? NSError(domain: "snap", code: 1)); return }
            guard let tiff = image.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff),
                  let png = rep.representation(using: .png, properties: [:]) else {
                FileHandle.standardError.write("encode failed\n".data(using: .utf8)!); exit(1)
            }
            do { try png.write(to: self.out) } catch {
                FileHandle.standardError.write("write failed: \(error)\n".data(using: .utf8)!); exit(1)
            }
            print("\(self.out.lastPathComponent) \(rep.pixelsWide)x\(rep.pixelsHigh)")
            exit(0)
        }
    }
}

let shooter = Shooter(size: NSSize(width: w, height: h), out: outURL)
shooter.load(inURL)

// Hard timeout so a hung load can never wedge the harness.
DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
    FileHandle.standardError.write("timeout\n".data(using: .utf8)!)
    exit(1)
}
app.run()
