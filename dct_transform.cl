#define BLOCK_SIZE_LOG2 3
#define BLOCK_SIZE (1 << BLOCK_SIZE_LOG2)

__constant float dct_coefficients[BLOCK_SIZE * BLOCK_SIZE] = {
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.35355339059327378637f,
   0.49039264020161521529f,
   0.41573480615127261784f,
   0.27778511650980114434f,
   0.09754516100806416568f,
  -0.09754516100806409629f,
  -0.27778511650980097780f,
  -0.41573480615127267335f,
  -0.49039264020161521529f,
   0.46193976625564336924f,
   0.19134171618254491865f,
  -0.19134171618254486313f,
  -0.46193976625564336924f,
  -0.46193976625564342475f,
  -0.19134171618254516845f,
   0.19134171618254500191f,
   0.46193976625564325822f,
   0.41573480615127261784f,
  -0.09754516100806409629f,
  -0.49039264020161521529f,
  -0.27778511650980108882f,
   0.27778511650980092229f,
   0.49039264020161521529f,
   0.09754516100806438772f,
  -0.41573480615127256232f,
   0.35355339059327378637f,
  -0.35355339059327373086f,
  -0.35355339059327384188f,
   0.35355339059327367535f,
   0.35355339059327384188f,
  -0.35355339059327334228f,
  -0.35355339059327356432f,
   0.35355339059327328677f,
   0.27778511650980114434f,
  -0.49039264020161521529f,
   0.09754516100806415180f,
   0.41573480615127278437f,
  -0.41573480615127256232f,
  -0.09754516100806401302f,
   0.49039264020161532631f,
  -0.27778511650980075576f,
   0.19134171618254491865f,
  -0.46193976625564342475f,
   0.46193976625564325822f,
  -0.19134171618254494640f,
  -0.19134171618254527947f,
   0.46193976625564336924f,
  -0.46193976625564320271f,
   0.19134171618254477987f,
   0.09754516100806416568f,
  -0.27778511650980108882f,
   0.41573480615127278437f,
  -0.49039264020161532631f,
   0.49039264020161521529f,
  -0.41573480615127250681f,
   0.27778511650980075576f,
  -0.09754516100806429058f
};

void convert_to_relative_range(__local float* block, int x, int y) {
  float s = block[(y << BLOCK_SIZE_LOG2) + x];
  s = (s * 2.0f) - 1.0f;
  block[(y << BLOCK_SIZE_LOG2) + x] = s;
  barrier(CLK_LOCAL_MEM_FENCE);
}

void convert_to_absolute_range(__local float* block, int x, int y) {
  float s = block[(y << BLOCK_SIZE_LOG2) + x];
  s = (s + 1.0f) * 0.5f;
  block[(y << BLOCK_SIZE_LOG2) + x] = s;
  barrier(CLK_LOCAL_MEM_FENCE);
}

void compute_dct(__local float* block, int offset, int stride_log2, int k) {
  float s = 0.0f;
  for (int n = 0; n < BLOCK_SIZE; n++) {
    float v = block[offset + (n << stride_log2)];
    float c = dct_coefficients[(k << BLOCK_SIZE_LOG2) + n];
    s += (v * c);
  }
  s /= BLOCK_SIZE;
  barrier(CLK_LOCAL_MEM_FENCE);
  block[offset + (k << stride_log2)] = s;
  barrier(CLK_LOCAL_MEM_FENCE);
}

void compute_dct_x(__local float* block, int x, int y) {
  compute_dct(block, y << BLOCK_SIZE_LOG2, 0, x);
}

void compute_dct_y(__local float* block, int x, int y) {
  compute_dct(block, x, BLOCK_SIZE_LOG2, y);
}

void compute_dct_xy(__local float* block, int x, int y) {
  compute_dct_x(block, x, y);
  compute_dct_y(block, x, y);
}

void compute_idct(__local float* block, int offset, int stride_log2, int k) {
  float s = 0.0f;
  for (int n = 0; n < BLOCK_SIZE; n++) {
    float v = block[offset + (n << stride_log2)];
    float c = dct_coefficients[(n << BLOCK_SIZE_LOG2) + k];
    s += (v * c);
  }
  s *= BLOCK_SIZE;
  barrier(CLK_LOCAL_MEM_FENCE);
  block[offset + (k << stride_log2)] = s;
  barrier(CLK_LOCAL_MEM_FENCE);
}

void compute_idct_x(__local float* block, int x, int y) {
  compute_idct(block, y << BLOCK_SIZE_LOG2, 0, x);
}

void compute_idct_y(__local float* block, int x, int y) {
  compute_idct(block, x, BLOCK_SIZE_LOG2, y);
}

void compute_idct_xy(__local float* block, int x, int y) {
  compute_idct_y(block, x, y);
  compute_idct_x(block, x, y);
}

void copy_to_block(__local float* block, int x, int y, float s) {
  block[(y << BLOCK_SIZE_LOG2) + x] = s;
  barrier(CLK_LOCAL_MEM_FENCE);
}

__kernel void
__attribute__((reqd_work_group_size(BLOCK_SIZE, BLOCK_SIZE, 1)))
dct_transform(__write_only image2d_t target, __read_only image2d_t source) {
  int2 coordinates = { get_global_id(0), get_global_id(1) };
  if (coordinates.x >= get_image_width(source)) {
    return;
  }
  if (coordinates.y >= get_image_height(source)) {
    return;
  }
  if (coordinates.x >= get_image_width(target)) {
    return;
  }
  if (coordinates.y >= get_image_height(target)) {
    return;
  }
  sampler_t sampler = CLK_NORMALIZED_COORDS_FALSE | CLK_ADDRESS_CLAMP | CLK_FILTER_NEAREST;
  float s = read_imagef(source, sampler, coordinates).s0;
  int x = get_local_id(0);
  int y = get_local_id(1);
  __local float block[BLOCK_SIZE * BLOCK_SIZE];
  copy_to_block(block, x, y, s);
  convert_to_relative_range(block, x, y);
  compute_dct_xy(block, x, y);
  convert_to_absolute_range(block, x, y);
  s = block[(y << BLOCK_SIZE_LOG2) + x];
  write_imagef(target, coordinates, (float4) s);
}

__kernel void
__attribute__((reqd_work_group_size(BLOCK_SIZE, BLOCK_SIZE, 1)))
idct_transform(__write_only image2d_t target, __read_only image2d_t source) {
  int2 coordinates = { get_global_id(0), get_global_id(1) };
  if (coordinates.x >= get_image_width(source)) {
    return;
  }
  if (coordinates.y >= get_image_height(source)) {
    return;
  }
  if (coordinates.x >= get_image_width(target)) {
    return;
  }
  if (coordinates.y >= get_image_height(target)) {
    return;
  }
  sampler_t sampler = CLK_NORMALIZED_COORDS_FALSE | CLK_ADDRESS_CLAMP | CLK_FILTER_NEAREST;
  float s = read_imagef(source, sampler, coordinates).s0;
  int x = get_local_id(0);
  int y = get_local_id(1);
  __local float block[BLOCK_SIZE * BLOCK_SIZE];
  copy_to_block(block, x, y, s);
  convert_to_relative_range(block, x, y);
  compute_idct_xy(block, x, y);
  convert_to_absolute_range(block, x, y);
  s = block[(y << BLOCK_SIZE_LOG2) + x];
  write_imagef(target, coordinates, (float4) s);
}
