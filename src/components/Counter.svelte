<script>
  let count = 0;
  function increment() {
    count += 1;
  }
</script>

<div class="card w-96 bg-base-100 shadow-xl border border-base-300">
  <div class="card-body items-center text-center">
    <h2 class="card-title">DaisyUI + Svelte</h2>
    <p class="text-2xl my-4">Count: {count}</p>
    <div class="card-actions">
      <button class="btn btn-primary" on:click={increment}>
        Increment
      </button>
    </div>
  </div>
</div>
