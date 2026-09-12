import os
import json
import argparse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from adaptq.replay import ReplayEngine, _get_binary

# Mock data for demonstration purposes if no AQSS file is provided
MOCK_DATA = [
    {
        "strategy": "fp_passthrough",
        "n_tokens": 1024,
        "wall_time_ms": 47.1,
        "avg_latency_us": 46.0,
        "avg_quality": 1.0,
        "avg_bits_per_dim": 16.0
    },
    {
        "strategy": "har_fixed_4bit",
        "n_tokens": 1024,
        "wall_time_ms": 50.3,
        "avg_latency_us": 49.1,
        "avg_quality": 0.947,
        "avg_bits_per_dim": 4.0
    },
    {
        "strategy": "har_fixed_3bit",
        "n_tokens": 1024,
        "wall_time_ms": 41.4,
        "avg_latency_us": 40.4,
        "avg_quality": 0.892,
        "avg_bits_per_dim": 3.0
    },
    {
        "strategy": "har_fixed_2bit",
        "n_tokens": 1024,
        "wall_time_ms": 38.4,
        "avg_latency_us": 37.5,
        "avg_quality": 0.784,
        "avg_bits_per_dim": 2.0
    }
]


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(__file__), "static"), **kwargs)

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == "/api/compare":
            self.handle_api_compare()
        else:
            super().do_GET()

    def handle_api_compare(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

        aqss_file = self.server.aqss_file

        if aqss_file and os.path.exists(aqss_file):
            try:
                engine = ReplayEngine()
                # Run the compare using the real binary
                result = engine.compare(
                    aqss_file,
                    strategies=["fp_passthrough", "har_fixed", "har_fixed_3bit", "har_fixed_2bit"]
                )
                response_data = {"status": "success", "data": result.rows}
            except Exception as e:
                response_data = {"status": "error", "message": str(e), "data": MOCK_DATA}
        else:
            # Fallback to mock data to demonstrate the dashboard
            response_data = {"status": "mock", "message": "No valid AQSS file provided, using mock data", "data": MOCK_DATA}

        self.wfile.write(json.dumps(response_data).encode('utf-8'))


def run(port, aqss_file):
    server_address = ('', port)
    httpd = HTTPServer(server_address, DashboardHandler)
    httpd.aqss_file = aqss_file
    print(f"🚀 AdapTQ Insight Dashboard running on http://localhost:{port}")
    if aqss_file:
        print(f"📊 Analyzing snapshot: {aqss_file}")
    else:
        print("⚠️ No snapshot provided, dashboard will run in Demo mode with mock data.")
    print("Press Ctrl+C to stop.")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Dashboard stopped.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="AdapTQ Insight Dashboard")
    parser.add_argument("snapshot", nargs="?", help="Path to .aqss session snapshot to analyze", default=None)
    parser.add_argument("--port", type=int, default=8080, help="Port to run the dashboard on (default: 8080)")
    args = parser.parse_args()
    
    run(args.port, args.snapshot)
