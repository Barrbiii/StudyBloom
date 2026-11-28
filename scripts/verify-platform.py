"""Assert the running stack's image and CPU architecture, not only successful build."""
import os
import subprocess
expected=os.environ.get('EXPECTED_ARCH')
if expected not in ('amd64','arm64'):
    raise SystemExit('Укажи EXPECTED_ARCH=amd64 или arm64')
for service in ['db','backend','frontend']:
    image=subprocess.check_output(['docker','compose','images','-q',service],text=True).strip()
    assert image and len(image.splitlines())==1, service
    actual=subprocess.check_output(['docker','image','inspect','--format','{{.Os}}/{{.Architecture}}',image],text=True).strip()
    assert actual=='linux/'+expected,(service,actual,expected)
    print(service,actual)
runtime=subprocess.check_output(['docker','compose','exec','-T','backend','python','-c','import platform;print(platform.machine())'],text=True).strip()
assert runtime in ({'aarch64','arm64'} if expected=='arm64' else {'x86_64','amd64'}),runtime
print('Architecture check: running backend CPU',runtime,'OK')
