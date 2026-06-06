"""
启动模型推理服务
这是主要的模型服务入口
"""
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    # 获取当前目录
    current_dir = Path(__file__).parent
    service_file = current_dir / "model_inference_service.py"
    
    print("🚀 启动模型推理服务...")
    print(f"📁 服务文件: {service_file}")
    print("=" * 70)
    
    # 启动服务
    subprocess.run([sys.executable, str(service_file)])

