COMPILER_OPTIONS="-std=c++11 -shared-libgcc "
INCLUDES="-I c:\\cuda\\include\\ -L c:\\cuda\lib\\Win32\\"

gcc $COMPILER_OPTIONS $INCLUDES filter.cpp -o filter.exe -l stdc++ -l OpenCL
gcc $COMPILER_OPTIONS $INCLUDES filter16.cpp -o filter16.exe -l stdc++ -l OpenCL
