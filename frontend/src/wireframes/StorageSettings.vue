<!--
  WIREFRAME — Cài đặt > Lưu trữ file (cấu hình S3 theo từng công ty)

  Trang tĩnh để duyệt bố cục và luồng thao tác. Dữ liệu cứng, không gọi API.
  Nút "Kiểm tra kết nối" mô phỏng kết quả để xem đủ các trạng thái.
-->
<template>
  <v-app>
    <v-main style="background: rgb(250,250,252)">
      <v-container class="py-8" style="max-width: 1100px">
        <div class="d-flex align-center ga-3 mb-2">
          <h1 class="text-h5 font-weight-bold">Cài đặt</h1>
          <v-chip size="small" color="warning" variant="tonal">WIREFRAME</v-chip>
        </div>
        <div class="text-body-2 text-grey mb-6">
          Mô phỏng tab mới <strong>Lưu trữ file</strong>. Bấm thử các nút để xem từng trạng thái.
        </div>

        <v-row>
          <v-col cols="12" md="3">
            <v-card class="pa-2">
              <v-list density="compact" nav>
                <v-list-item prepend-icon="mdi-robot" title="Cấu hình AI" rounded="lg" />
                <v-list-item prepend-icon="mdi-chart-bar" title="Phân tích" rounded="lg" />
                <v-list-item
                  prepend-icon="mdi-folder-multiple-image"
                  title="Lưu trữ file"
                  rounded="lg"
                  color="primary"
                  active
                />
                <v-list-item prepend-icon="mdi-cog" title="Chung" rounded="lg" />
              </v-list>
            </v-card>
          </v-col>

          <v-col cols="12" md="9">
            <v-card class="pa-6">
              <div class="text-subtitle-1 font-weight-bold mb-1">
                <v-icon start size="small">mdi-folder-multiple-image</v-icon>
                Lưu trữ file đính kèm
              </div>
              <div class="text-body-2 text-grey mb-5">
                Ảnh, video, tài liệu khách gửi trong cuộc chat. Mặc định lưu trên máy chủ; chuyển
                sang S3 để khỏi đầy ổ cứng. Cấu hình này riêng cho công ty <strong>SePay</strong>.
              </div>

              <!-- Trạng thái hiện tại -->
              <v-alert
                :type="daBat ? 'success' : 'info'"
                variant="tonal"
                density="comfortable"
                class="mb-5"
              >
                <div class="d-flex align-center flex-wrap ga-2">
                  <span v-if="daBat">
                    Đang lưu lên <strong>S3</strong> · {{ form.bucket }} · {{ rutGonEndpoint }}
                  </span>
                  <span v-else>
                    Đang lưu trên <strong>máy chủ</strong> — đã dùng 892 MB cho 6.396 file
                  </span>
                </div>
              </v-alert>

              <v-switch
                v-model="daBat"
                color="primary"
                density="compact"
                hide-details
                class="mb-2"
                :label="daBat ? 'Dùng S3 cho công ty này' : 'Bật để dùng S3 cho công ty này'"
              />

              <v-expand-transition>
                <div v-if="daBat">
                  <v-divider class="my-4" />

                  <v-text-field
                    v-model="form.endpoint"
                    label="Địa chỉ dịch vụ (Endpoint)"
                    placeholder="https://s3.nha-cung-cap.vn"
                    density="comfortable"
                    class="mb-3"
                    hide-details="auto"
                    @update:model-value="ketQua = null"
                  />

                  <v-row dense>
                    <v-col cols="12" sm="7">
                      <v-text-field
                        v-model="form.bucket"
                        label="Bucket"
                        density="comfortable"
                        hide-details="auto"
                        @update:model-value="ketQua = null"
                      />
                    </v-col>
                    <v-col cols="12" sm="5">
                      <v-text-field
                        v-model="form.region"
                        label="Region (không bắt buộc)"
                        density="comfortable"
                        hide-details="auto"
                      />
                    </v-col>
                  </v-row>

                  <v-text-field
                    v-model="form.accessKey"
                    label="Access Key"
                    density="comfortable"
                    class="mt-3"
                    hide-details="auto"
                    @update:model-value="ketQua = null"
                  />

                  <v-text-field
                    v-model="form.secretKey"
                    label="Secret Key"
                    type="password"
                    density="comfortable"
                    class="mt-3"
                    hide-details="auto"
                    hint="Đã lưu thì hiện dấu chấm; để nguyên là giữ khoá cũ"
                    persistent-hint
                    @update:model-value="ketQua = null"
                  />

                  <v-expansion-panels variant="accordion" class="mt-4">
                    <v-expansion-panel elevation="0">
                      <v-expansion-panel-title class="text-body-2">
                        Tuỳ chọn nâng cao
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <v-text-field
                          v-model="form.prefix"
                          label="Tiền tố khoá (khi dùng chung bucket với thứ khác)"
                          density="comfortable"
                          hide-details="auto"
                        />
                        <v-switch
                          v-model="form.pathStyle"
                          color="primary"
                          density="compact"
                          hide-details
                          class="mt-2"
                          label="Dùng path-style (chỉ cần với vài nhà cung cấp)"
                        />
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>

                  <!-- Kết quả kiểm tra -->
                  <v-alert
                    v-if="ketQua === 'ok'"
                    type="success"
                    variant="tonal"
                    density="comfortable"
                    class="mt-4"
                  >
                    Kết nối được, ghi và đọc thử thành công. Bấm Lưu để áp dụng.
                  </v-alert>
                  <v-alert
                    v-else-if="ketQua === 'sai-khoa'"
                    type="error"
                    variant="tonal"
                    density="comfortable"
                    class="mt-4"
                  >
                    <div class="font-weight-medium">Sai Access Key hoặc Secret Key</div>
                    <div class="text-body-2">Dịch vụ trả về: SignatureDoesNotMatch</div>
                  </v-alert>
                  <v-alert
                    v-else-if="ketQua === 'khong-ghi-duoc'"
                    type="error"
                    variant="tonal"
                    density="comfortable"
                    class="mt-4"
                  >
                    <div class="font-weight-medium">Đọc được nhưng không ghi được vào bucket</div>
                    <div class="text-body-2">
                      Khoá này thiếu quyền ghi. Cần quyền đọc, ghi và xoá trên bucket
                      <strong>{{ form.bucket }}</strong>.
                    </div>
                  </v-alert>

                  <div class="d-flex flex-wrap align-center ga-3 mt-5">
                    <v-btn
                      variant="outlined"
                      :loading="dangKiem"
                      prepend-icon="mdi-lan-connect"
                      @click="kiemTra"
                    >
                      Kiểm tra kết nối
                    </v-btn>
                    <v-btn
                      color="primary"
                      :disabled="ketQua !== 'ok'"
                      prepend-icon="mdi-content-save"
                    >
                      Lưu cài đặt
                    </v-btn>
                    <span v-if="ketQua !== 'ok'" class="text-caption text-grey">
                      Kiểm tra kết nối thành công rồi mới lưu được
                    </span>
                  </div>

                  <v-divider class="my-6" />

                  <div class="text-body-2 font-weight-medium mb-1">Ảnh cũ đang nằm trên máy chủ</div>
                  <div class="text-body-2 text-grey mb-3">
                    Bật S3 xong, ảnh mới lên S3 còn <strong>892 MB ảnh cũ vẫn xem được bình thường</strong>
                    từ máy chủ. Chuyển chúng lên S3 lúc nào cũng được, không gấp.
                  </div>
                  <v-btn
                    variant="text"
                    color="primary"
                    size="small"
                    prepend-icon="mdi-book-open-variant"
                  >
                    Xem hướng dẫn chuyển file cũ
                  </v-btn>

                  <div class="text-caption text-grey mt-6">
                    Mô phỏng: bấm Kiểm tra nhiều lần để xem lần lượt thành công → sai khoá → thiếu quyền ghi.
                  </div>
                </div>
              </v-expand-transition>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const daBat = ref(false)
const dangKiem = ref(false)
const ketQua = ref<null | 'ok' | 'sai-khoa' | 'khong-ghi-duoc'>(null)
const lanKiem = ref(0)

const form = ref({
  endpoint: 'https://s3-hcm-r2.s3cloud.vn',
  bucket: 'cqa-sepay',
  region: 'hcm',
  accessKey: 'ZJHQ7W4H66N4ZFFUE2RL',
  secretKey: '••••••••••••',
  prefix: '',
  pathStyle: false,
})

const rutGonEndpoint = computed(() =>
  form.value.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, ''),
)

// Mô phỏng ba kết quả để duyệt giao diện, không gọi API thật.
function kiemTra() {
  dangKiem.value = true
  ketQua.value = null
  setTimeout(() => {
    dangKiem.value = false
    const vong = ['ok', 'sai-khoa', 'khong-ghi-duoc'] as const
    ketQua.value = vong[lanKiem.value % vong.length]
    lanKiem.value++
  }, 700)
}
</script>
