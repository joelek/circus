#include <fstream>
#include <iostream>
#include <streambuf>
#include <vector>

#include <CL/cl.hpp>

#include "fcntl.h"
#include "io.h"

const char *getErrorString(cl_int error)
{
switch(error){
    // run-time and JIT compiler errors
    case 0: return "CL_SUCCESS";
    case -1: return "CL_DEVICE_NOT_FOUND";
    case -2: return "CL_DEVICE_NOT_AVAILABLE";
    case -3: return "CL_COMPILER_NOT_AVAILABLE";
    case -4: return "CL_MEM_OBJECT_ALLOCATION_FAILURE";
    case -5: return "CL_OUT_OF_RESOURCES";
    case -6: return "CL_OUT_OF_HOST_MEMORY";
    case -7: return "CL_PROFILING_INFO_NOT_AVAILABLE";
    case -8: return "CL_MEM_COPY_OVERLAP";
    case -9: return "CL_IMAGE_FORMAT_MISMATCH";
    case -10: return "CL_IMAGE_FORMAT_NOT_SUPPORTED";
    case -11: return "CL_BUILD_PROGRAM_FAILURE";
    case -12: return "CL_MAP_FAILURE";
    case -13: return "CL_MISALIGNED_SUB_BUFFER_OFFSET";
    case -14: return "CL_EXEC_STATUS_ERROR_FOR_EVENTS_IN_WAIT_LIST";
    case -15: return "CL_COMPILE_PROGRAM_FAILURE";
    case -16: return "CL_LINKER_NOT_AVAILABLE";
    case -17: return "CL_LINK_PROGRAM_FAILURE";
    case -18: return "CL_DEVICE_PARTITION_FAILED";
    case -19: return "CL_KERNEL_ARG_INFO_NOT_AVAILABLE";

    // compile-time errors
    case -30: return "CL_INVALID_VALUE";
    case -31: return "CL_INVALID_DEVICE_TYPE";
    case -32: return "CL_INVALID_PLATFORM";
    case -33: return "CL_INVALID_DEVICE";
    case -34: return "CL_INVALID_CONTEXT";
    case -35: return "CL_INVALID_QUEUE_PROPERTIES";
    case -36: return "CL_INVALID_COMMAND_QUEUE";
    case -37: return "CL_INVALID_HOST_PTR";
    case -38: return "CL_INVALID_MEM_OBJECT";
    case -39: return "CL_INVALID_IMAGE_FORMAT_DESCRIPTOR";
    case -40: return "CL_INVALID_IMAGE_SIZE";
    case -41: return "CL_INVALID_SAMPLER";
    case -42: return "CL_INVALID_BINARY";
    case -43: return "CL_INVALID_BUILD_OPTIONS";
    case -44: return "CL_INVALID_PROGRAM";
    case -45: return "CL_INVALID_PROGRAM_EXECUTABLE";
    case -46: return "CL_INVALID_KERNEL_NAME";
    case -47: return "CL_INVALID_KERNEL_DEFINITION";
    case -48: return "CL_INVALID_KERNEL";
    case -49: return "CL_INVALID_ARG_INDEX";
    case -50: return "CL_INVALID_ARG_VALUE";
    case -51: return "CL_INVALID_ARG_SIZE";
    case -52: return "CL_INVALID_KERNEL_ARGS";
    case -53: return "CL_INVALID_WORK_DIMENSION";
    case -54: return "CL_INVALID_WORK_GROUP_SIZE";
    case -55: return "CL_INVALID_WORK_ITEM_SIZE";
    case -56: return "CL_INVALID_GLOBAL_OFFSET";
    case -57: return "CL_INVALID_EVENT_WAIT_LIST";
    case -58: return "CL_INVALID_EVENT";
    case -59: return "CL_INVALID_OPERATION";
    case -60: return "CL_INVALID_GL_OBJECT";
    case -61: return "CL_INVALID_BUFFER_SIZE";
    case -62: return "CL_INVALID_MIP_LEVEL";
    case -63: return "CL_INVALID_GLOBAL_WORK_SIZE";
    case -64: return "CL_INVALID_PROPERTY";
    case -65: return "CL_INVALID_IMAGE_DESCRIPTOR";
    case -66: return "CL_INVALID_COMPILER_OPTIONS";
    case -67: return "CL_INVALID_LINKER_OPTIONS";
    case -68: return "CL_INVALID_DEVICE_PARTITION_COUNT";

    // extension errors
    case -1000: return "CL_INVALID_GL_SHAREGROUP_REFERENCE_KHR";
    case -1001: return "CL_PLATFORM_NOT_FOUND_KHR";
    case -1002: return "CL_INVALID_D3D10_DEVICE_KHR";
    case -1003: return "CL_INVALID_D3D10_RESOURCE_KHR";
    case -1004: return "CL_D3D10_RESOURCE_ALREADY_ACQUIRED_KHR";
    case -1005: return "CL_D3D10_RESOURCE_NOT_ACQUIRED_KHR";
    default: return "Unknown OpenCL error";
    }
}

int  PATCH_SIZE = 16;

void filter(
    cl::CommandQueue& queue,
    cl::Buffer& target_buffer_cl,
    float* target_buffer,
    cl::Image2D& source_image,
    unsigned char* image_buffer,
    cl::Kernel& dct_denoise,
    cl::Kernel& dct_denoise_normalise,
    int w,
    int h,
    float tresh,
    cl::Buffer& cl_buffer_acc_norm
  ) {
  cl::size_t<3> origin;
  cl::size_t<3> region;
  region[0] = w;
  region[1] = h;
  region[2] = 1;
  int err;

    if ((err = dct_denoise.setArg(0, source_image)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 0!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise.setArg(1, target_buffer_cl)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 1!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise.setArg(2, tresh)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 2!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise.setArg(5, w)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 5!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise.setArg(6, 0)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 6!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise.setArg(7, cl_buffer_acc_norm)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 7!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }



  if (queue.enqueueWriteImage(source_image, CL_TRUE, origin, region, 0, 0, image_buffer) != CL_SUCCESS) {
    std::cerr << "Error writing source image to device!\n";
    exit(EXIT_FAILURE);
  }
  cl_float val = 0.0f;
  if (queue.enqueueFillBuffer(target_buffer_cl, &val, 0, w*h*sizeof(float)) != CL_SUCCESS) {
    std::cerr << "Error clearing acc image!\n";
    exit(EXIT_FAILURE);
  }
  cl_int val2 = 0;
  if (queue.enqueueFillBuffer(cl_buffer_acc_norm, &val, 0, w*h*sizeof(float)) != CL_SUCCESS) {
    std::cerr << "Error clearing acc norm image!\n";
    exit(EXIT_FAILURE);
  }
  for (auto y = 0; y < PATCH_SIZE; y += 4) {
    for (auto x = 0; x < PATCH_SIZE; x += 4) {
      if ((err = dct_denoise.setArg(3, x)) != CL_SUCCESS) {
        std::cerr << "Error setting arg 3!\n";
        std::cerr << getErrorString(err);
        exit(EXIT_FAILURE);
      }
      if ((err = dct_denoise.setArg(4, y)) != CL_SUCCESS) {
        std::cerr << "Error setting arg 4!\n";
        std::cerr << getErrorString(err);
        exit(EXIT_FAILURE);
      }
auto w2 = ((w - x) / PATCH_SIZE) * PATCH_SIZE;
auto h2 = ((h - y) / PATCH_SIZE) * PATCH_SIZE;

      if ((err = queue.enqueueNDRangeKernel(dct_denoise,cl::NDRange(0, 0, 0),cl::NDRange(w2, h2, 1),cl::NDRange(PATCH_SIZE, PATCH_SIZE, 1))) != CL_SUCCESS) {
        std::cerr << "Error enqueueing kernel!\n";
        std::cerr << getErrorString(err);
        exit(EXIT_FAILURE);
      }
    }
  }
    if ((err = dct_denoise_normalise.setArg(0, target_buffer_cl)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 0!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise_normalise.setArg(1, source_image)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 1!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise_normalise.setArg(2, w)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 2!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }
    if ((err = dct_denoise_normalise.setArg(3, cl_buffer_acc_norm)) != CL_SUCCESS) {
      std::cerr << "Error setting arg 3!\n";
      std::cerr << getErrorString(err);
      exit(EXIT_FAILURE);
    }

auto w2 = ((w + PATCH_SIZE - 1) / PATCH_SIZE) * PATCH_SIZE;
auto h2 = ((h + PATCH_SIZE - 1) / PATCH_SIZE) * PATCH_SIZE;

  if ((err = queue.enqueueNDRangeKernel(dct_denoise_normalise,cl::NDRange(0, 0, 0),cl::NDRange(w2, h2, 1),cl::NDRange(PATCH_SIZE, PATCH_SIZE, 1))) != CL_SUCCESS) {
    std::cerr << "Error enqueueing kernel!\n";
    std::cerr << getErrorString(err);
    exit(EXIT_FAILURE);
  }
  if ((err = queue.enqueueReadImage(source_image,CL_TRUE,origin,region,0,0,image_buffer)) != CL_SUCCESS) {
    std::cerr << "Error reading source image (modified) from host!\n";
    std::cerr << getErrorString(err);
    exit(EXIT_FAILURE);
  }
  queue.finish();
}

int main(int argc, char **argv) {
  if (argc != 4) {
    return EXIT_FAILURE;
  }
  int WH = atoi(argv[1]);
  int HH = atoi(argv[2]);
  float TH = atof(argv[3]);
  int W = WH << 1;
  int H = HH << 1;
std::cerr << "W: " << W << " H: " << H << " TH: " << TH << "\n";
  try {
    std::vector<cl::Platform> all_platforms;
    cl::Platform::get(&all_platforms);
    if (all_platforms.size() == 0) {
      std::cerr << "No platforms found!\n";
      exit(EXIT_FAILURE);
    }
    cl::Platform default_platform = all_platforms[0];
    std::cerr << "Using platform: " << default_platform.getInfo<CL_PLATFORM_NAME>() << "\n";



    std::vector<cl::Device> all_devices;
    default_platform.getDevices(CL_DEVICE_TYPE_ALL, &all_devices);
    if (all_devices.size() == 0) {
      std::cerr << "No devices found!\n";
      exit(EXIT_FAILURE);
    }
    cl::Device default_device = all_devices[0];
    std::cerr << "Using device: " << default_device.getInfo<CL_DEVICE_NAME>() << "\n";



    cl::Context context(default_device);
    cl::CommandQueue queue(context, default_device);



    cl::Program::Sources sources;
    std::ifstream ifs("kernel16.cl");
    std::string kernel_code((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
    sources.push_back({ kernel_code.c_str(), kernel_code.length() });
    cl::Program program(context, sources);
    if (program.build({ default_device }) != CL_SUCCESS) {
      std::cerr << "Error building!\n";
      std::cerr << program.getBuildInfo<CL_PROGRAM_BUILD_LOG>(default_device) << "\n";
      exit(EXIT_FAILURE);
    }



    auto target_buffer = new float[W*H + WH*HH + WH*HH];


    int err;
    cl::Buffer target_buffer_cl_y(context,CL_MEM_READ_WRITE,sizeof(float)*W*H);
    cl::Buffer target_buffer_cl_u(context,CL_MEM_READ_WRITE,sizeof(float)*WH*HH);
    cl::Buffer target_buffer_cl_v(context,CL_MEM_READ_WRITE,sizeof(float)*WH*HH);
    cl::ImageFormat source_image_format = { CL_LUMINANCE, CL_UNORM_INT16 };
    cl::Image2D source_image_y(context, CL_MEM_READ_WRITE, source_image_format, W, H, 0, nullptr);
    cl::Image2D source_image_u(context, CL_MEM_READ_WRITE, source_image_format, WH, HH, 0, nullptr);
    cl::Image2D source_image_v(context, CL_MEM_READ_WRITE, source_image_format, WH, HH, 0, nullptr);


    cl::Buffer cl_buffer_acc_norm_y(context,CL_MEM_READ_WRITE,sizeof(float)*W*H);
    cl::Buffer cl_buffer_acc_norm_u(context,CL_MEM_READ_WRITE,sizeof(float)*WH*HH);
    cl::Buffer cl_buffer_acc_norm_v(context,CL_MEM_READ_WRITE,sizeof(float)*WH*HH);

    cl::Kernel dct_denoise(program, "dct_denoise");
    cl::Kernel dct_denoise_normalise(program, "dct_denoise_normalise");




/*
read entire frames, cyclic buffer, write out frames = free up space for new reads
*/

    _setmode(0, _O_BINARY);
    _setmode(1, _O_BINARY);



    size_t bytes_per_frame = (W*H + WH*HH + WH*HH)*2;
    auto frame_buffer_capacity = 2;
    auto frame_buffer = new unsigned char[frame_buffer_capacity * bytes_per_frame];
    auto frames_read = 0;
    auto frames_written = 0;
    while (!feof(stdin)) {
/*
      auto frame_slots_occupied = frames_read - frames_written;
      auto frame_slots_before_read = (frames_read % frame_buffer_capacity);
      auto frame_slots_before_write = (frames_written % frame_buffer_capacity);
      auto frame_slots_after_read = frame_buffer_capacity - frame_slots_before_read;
      auto frame_slots_after_write = frame_buffer_capacity - frame_slots_before_write;
*/


      auto total_frames_read = 0;
      for (auto i = frames_read; i < frames_written + frame_buffer_capacity; i++) {
        auto frame_slot = (i % frame_buffer_capacity);
        auto new_frames_read = fread(frame_buffer + (frame_slot * bytes_per_frame), bytes_per_frame, 1, stdin);
        if (new_frames_read == 0) {
          break;
        }
        total_frames_read += new_frames_read;
      }
      for (auto i = frames_read; i < frames_read + total_frames_read; i++) {
        auto frame_slot = (i % frame_buffer_capacity);
        auto imy = &frame_buffer[(frame_slot * bytes_per_frame) + 0];
        auto imu = &frame_buffer[(frame_slot * bytes_per_frame) + (W*H)*2];
        auto imv = &frame_buffer[(frame_slot * bytes_per_frame) + (W*H + WH*HH)*2];
        filter(
          queue,
          target_buffer_cl_y,
          target_buffer + 0,
          source_image_y,
          imy,
          dct_denoise,
          dct_denoise_normalise,
          W,
          H,
          TH,
          cl_buffer_acc_norm_y
        );
        filter(
          queue,
          target_buffer_cl_u,
          target_buffer + W*H,
          source_image_u,
          imu,
          dct_denoise,
          dct_denoise_normalise,
          WH,
          HH,
          TH,
          cl_buffer_acc_norm_u
        );
        filter(
          queue,
          target_buffer_cl_v,
          target_buffer + W*H + WH*HH,
          source_image_v,
          imv,
          dct_denoise,
          dct_denoise_normalise,
          WH,
          HH,
          TH,
          cl_buffer_acc_norm_v
        );
      }
      frames_read += total_frames_read;
      auto total_frames_written = 0;
      for (auto i = frames_written; i < frames_read; i++) {
        auto frame_slot = (i % frame_buffer_capacity);
        auto new_frames_written = fwrite(frame_buffer + (frame_slot * bytes_per_frame), bytes_per_frame, 1, stdout);
        if (new_frames_written == 0) {
          break;
        }
        total_frames_written += new_frames_written;
      }
      frames_written += total_frames_written;

/*




      auto max_frames_to_read = frame_slots_after_read;
      auto new_frames_read = (max_frames_to_read > 0) ? fread(frame_buffer + (frame_slots_before_read * bytes_per_frame), bytes_per_frame, max_frames_to_read, stdin) : 0;
      if (new_frames_read == max_frames_to_read) {
        max_frames_to_read = frame_slots_before_write;
        new_frames_read += (max_frames_to_read > 0) ? fread(frame_buffer, bytes_per_frame, max_frames_to_read, stdin) : 0;
      }
      for (auto i = 0; i < new_frames_read; i++) {
        auto frame_index = (frames_read + i) % frame_buffer_capacity;
        auto imy = &frame_buffer[(frame_index * bytes_per_frame) + 0];
        auto imu = &frame_buffer[(frame_index * bytes_per_frame) + (W*H)*2];
        auto imv = &frame_buffer[(frame_index * bytes_per_frame) + (W*H + WH*HH)*2];
        filter(
          queue,
          target_buffer_cl_y,
          target_buffer + 0,
          source_image_y,
          imy,
          dct_denoise,
          dct_denoise_normalise,
          W,
          H,
          float(TH)/100.0f
        );
        filter(
          queue,
          target_buffer_cl_u,
          target_buffer + W*H,
          source_image_u,
          imu,
          dct_denoise,
          dct_denoise_normalise,
          WH,
          HH,
          float(TH)/100.0f
        );
        filter(
          queue,
          target_buffer_cl_v,
          target_buffer + W*H + WH*HH,
          source_image_v,
          imv,
          dct_denoise,
          dct_denoise_normalise,
          WH,
          HH,
          float(TH)/100.0f
        );
      }
      frames_read += new_frames_read;
      auto frames_waiting_for_writing = frames_read - frames_written;
      auto max_frames_to_write = (frames_waiting_for_writing > frame_slots_after_write) ? frame_slots_after_write : frames_waiting_for_writing;
      auto new_frames_written = (max_frames_to_write > 0) ? fwrite(frame_buffer + (frame_slots_before_write * bytes_per_frame), bytes_per_frame, max_frames_to_write, stdout) : 0;
      if (new_frames_written == max_frames_to_write && frames_waiting_for_writing > new_frames_written) {
        max_frames_to_write = (frames_waiting_for_writing % frame_buffer_capacity);
        new_frames_written += (max_frames_to_write > 0) ? fwrite(frame_buffer, bytes_per_frame, max_frames_to_write, stdin) : 0;
      }
      frames_written += new_frames_written;
*/
    }
    return EXIT_SUCCESS;
  } catch (...) {
    std::cerr << "Caught error!\n";
    return EXIT_FAILURE;
  }
}
